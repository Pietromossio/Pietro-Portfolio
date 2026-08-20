require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Mancano SUPABASE_URL o SUPABASE_ANON_KEY nel file .env"
  );
}

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/portfolio-command", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione Supabase mancante"
      });
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Errore autenticazione Supabase:", userError);
      return res.status(401).json({
        error: "Utente non autenticato"
      });
    }

    const command = String(req.body?.command || "").trim();

    if (!command) {
      return res.status(400).json({
        error: "Comando mancante"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: command,
      config: {
        systemInstruction:
  "Interpreta comandi per un portafoglio finanziario. " +
  "Rispondi esclusivamente con JSON valido, senza markdown. " +
  "Azioni consentite: buy, show, delete, clarify. " +
  "Formato: {\"action\":\"buy|show|delete|clarify\",\"assetName\":\"string|null\",\"quantity\":\"number|null\",\"price\":\"number|null\",\"currency\":\"EUR\",\"platform\":\"Trade Republic|Mediolanum|Bitget|Revolut|null\",\"message\":\"string\"}. " +
  "Riconosci sempre la piattaforma se l'utente la nomina. " +
  "Se dice Bitget, restituisci esattamente platform:\"Bitget\". " +
  "Se non nomina alcuna piattaforma,guarda se ha già quel prodotto in una piattaforma, significa che va aggiunto li, altrimenti restituisci platform:null. " +
  "Usa buy per un acquisto. " +
  "Usa show per visualizzare una posizione. " +
  "Usa delete per eliminare una posizione. " +
  "Usa clarify quando mancano informazioni. " +
  "Per buy sono obbligatori nome, quantità e prezzo. " +
  "Non inventare mai dati finanziari."
      },
      responseMimeType: "application/json"
    });

    const text = response.text.trim();
    const result = JSON.parse(text);

    if (result.action === "buy") {
const commandLower = command.toLowerCase();

let platform = result.platform || null;

if (commandLower.includes("bitget")) {
  platform = "Bitget";
} else if (commandLower.includes("trade republic")) {
  platform = "Trade Republic";
} else if (commandLower.includes("mediolanum")) {
  platform = "Mediolanum";
} else if (commandLower.includes("revolut")) {
  platform = "Revolut";
}

result.platform = platform || "Altro";

console.log("Piattaforma rilevata:", result.platform);
console.log("Comando ricevuto:", command);
  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Utente non autenticato.");
  }

  const user = userData.user;

  const quantity = Number(result.quantity);
  const price = Number(result.price);

  if (!result.assetName || quantity <= 0 || price < 0) {
    throw new Error("Dati dell'acquisto non validi.");
  }

  const { data: existing, error: findError } = await supabaseClient
    .from("holdings")
    .select("*")
    .eq("user_id", user.id)
    .ilike("name", result.assetName)
    .maybeSingle();

  if (findError) {
    console.error("Errore ricerca holding:", findError);
    throw findError;
  }

  let holding;

  if (existing) {
    const oldQuantity = Number(existing.quantity) || 0;
    const oldAverage = Number(existing.average_price) || 0;
    const newQuantity = oldQuantity + quantity;

    const newAverage =
      ((oldQuantity * oldAverage) + (quantity * price)) / newQuantity;

    const { data, error } = await supabaseClient
      .from("holdings")
      .update({
  quantity: newQuantity,
  average_price: newAverage,
  currency: result.currency || "EUR",
  platform: result.platform
})
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Errore aggiornamento holding:", error);
      throw error;
    }

    holding = data;
  } else {
    const { data, error } = await supabaseClient
  .from("holdings")
  .insert({
    user_id: user.id,
    name: result.assetName,
    quantity,
    average_price: price,
    currency: result.currency || "EUR",
    platform: result.platform
  })
  .select()
  .single();

    if (error) {
      console.error("Errore inserimento holding:", error);
      throw error;
    }

    holding = data;
  }

  console.log("Holding salvata:", holding);

  return res.json({
    ...result,
    saved: true,
    holding
  });
}

return res.json(result);
  } catch (error) {
    console.error("Errore AI:", error);

    return res.status(500).json({
      error: "Errore del server AI"
    });
  }
});

app.delete("/api/holdings/:id", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione Supabase mancante"
      });
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        error: "Utente non autenticato"
      });
    }

    const holdingId = req.params.id;

    const { data: holding, error: findError } = await supabaseClient
      .from("holdings")
      .select("*")
      .eq("id", holdingId)
      .eq("user_id", user.id)
      .single();

    if (findError || !holding) {
      return res.status(404).json({
        error: "Posizione non trovata"
      });
    }


const { error: holdingDeleteError } = await supabaseClient
  .from("holdings")
  .delete()
  .eq("id", holding.id)
  .eq("user_id", user.id);

if (holdingDeleteError) {
  console.error("Errore eliminazione holding:", holdingDeleteError);
  throw holdingDeleteError;
}

    return res.json({
      deleted: true,
      holding
    });
  } catch (error) {
    console.error("Errore eliminazione posizione:", error);

    return res.status(500).json({
      error: "Errore durante l'eliminazione"
    });
  }
});
// ============================================
// TOOL: get_monthly_returns
// ============================================
app.post("/api/tools/get_monthly_returns", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione Supabase mancante"
      });
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Errore autenticazione Supabase:", userError);
      return res.status(401).json({
        error: "Utente non autenticato"
      });
    }

    const { data, error } = await supabaseClient.rpc("get_monthly_returns", {
      p_user_id: user.id
    });

    if (error) {
      console.error("Errore get_monthly_returns:", error);
      return res.status(500).json({
        error: "Errore nell'esecuzione della query",
        details: error.message
      });
    }

    // Trova il mese migliore
    const bestMonth = data.reduce((best, row) => 
      (!best || row.monthly_return_pct > best.monthly_return_pct) ? row : best
    , null);

    return res.json({
      monthly_returns: data,
      best_month: bestMonth
    });
  } catch (error) {
    console.error("Errore get_monthly_returns:", error);
    return res.status(500).json({
      error: "Errore del server",
      details: error.message
    });
  }
});

// ============================================
// TOOL: simulate_sip
// ============================================
app.post("/api/tools/simulate_sip", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione Supabase mancante"
      });
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Errore autenticazione Supabase:", userError);
      return res.status(401).json({
        error: "Utente non autenticato"
      });
    }

    const { asset_symbol, start_date, monthly_amount } = req.body;

    if (!asset_symbol || !start_date || !monthly_amount) {
      return res.status(400).json({
        error: "Parametri mancanti: asset_symbol, start_date, monthly_amount richiesti"
      });
    }

    const { data, error } = await supabaseClient.rpc("simulate_sip", {
      p_asset_symbol: asset_symbol,
      p_start_date: start_date,
      p_monthly_amount: monthly_amount
    });

    if (error) {
      console.error("Errore simulate_sip:", error);
      return res.status(500).json({
        error: "Errore nell'esecuzione della query",
        details: error.message
      });
    }

    return res.json({
      asset_symbol,
      start_date,
      monthly_amount,
      result: data[0]
    });
  } catch (error) {
    console.error("Errore simulate_sip:", error);
    return res.status(500).json({
      error: "Errore del server",
      details: error.message
    });
  }
});
// ============================================
// ENDPOINT INTELLIGENTE: /api/chat
// ============================================
app.post("/api/chat", async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");

    if (!accessToken) {
      return res.status(401).json({
        error: "Sessione Supabase mancante"
      });
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Errore autenticazione Supabase:", userError);
      return res.status(401).json({
        error: "Utente non autenticato"
      });
    }

    const userMessage = String(req.body?.message || "").trim();

    if (!userMessage) {
      return res.status(400).json({
        error: "Messaggio mancante"
      });
    }

    // ==========================================
    // FASE 1: Gemini decide quale tool chiamare
    // ==========================================
    const toolDecisionPrompt = `
Sei un assistente che analizza domande sul portafoglio finanziario di un utente.

Hai accesso a questi tool:
1. get_portfolio_summary → riepilogo del portafoglio (valore, P&L, allocazione)
2. get_monthly_returns → rendimenti mensili, mese migliore/peggiore
3. simulate_shock → simulazione shock di prezzo su un asset (es. "Se Bitcoin scende del 20%")
4. simulate_sip → simulazione piano di accumulo (es. "Se avessi investito 500€ al mese in S&P500...")

Analizza la domanda dell'utente e rispondi ESCLUSIVAMENTE con un JSON valido in questo formato:
{
  "tool": "nome_tool" | null,
  "tool_params": { ... } | null,
  "needs_tool": true | false,
  "clarification_needed": true | false,
  "clarification_message": "stringa" | null
}

Regole:
- Se la domanda è un riepilogo generale ("Come sta andando il mio portafoglio?"), usa get_portfolio_summary
- Se chiede del mese migliore/rendimenti mensili, usa get_monthly_returns
- Se chiede uno scenario "se X scende del Y%", usa simulate_shock con asset_name_pattern e shock_pct
- Se chiede una simulazione SIP ("se avessi investito X€ al mese in Y da..."), usa simulate_sip con asset_symbol, start_date, monthly_amount
- Se la domanda non richiede dati (es. "ciao", "grazie"), needs_tool = false
- Se mancano informazioni critiche (es. quale asset, quale data), clarification_needed = true

Esempi:

Domanda: "Come sta andando il mio portafoglio?"
Risposta: {"tool": "get_portfolio_summary", "tool_params": {}, "needs_tool": true, "clarification_needed": false, "clarification_message": null}

Domanda: "Qual è stato il mio mese migliore?"
Risposta: {"tool": "get_monthly_returns", "tool_params": {}, "needs_tool": true, "clarification_needed": false, "clarification_message": null}

Domanda: "Se Bitcoin scende del 20%, quanto perde il mio patrimonio?"
Risposta: {"tool": "simulate_shock", "tool_params": {"asset_name_pattern": "%Bitcoin%", "shock_pct": -0.2}, "needs_tool": true, "clarification_needed": false, "clarification_message": null}

Domanda: "Se avessi investito 500€ in S&P500 ogni mese da gennaio 2024 quanto avrei oggi?"
Risposta: {"tool": "simulate_sip", "tool_params": {"asset_symbol": "SPY", "start_date": "2024-01-01", "monthly_amount": 500}, "needs_tool": true, "clarification_needed": false, "clarification_message": null}

Domanda: "Ciao"
Risposta: {"tool": null, "tool_params": {}, "needs_tool": false, "clarification_needed": false, "clarification_message": null}

Domanda dell'utente: "${userMessage}"

Rispondi SOLO con il JSON, senza markdown, senza testo aggiuntivo.
`.trim();

    const decisionResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: toolDecisionPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const decisionText = decisionResponse.text.trim();
    const decision = JSON.parse(decisionText);

    // ==========================================
    // FASE 2: Chiama il tool se necessario
    // ==========================================
    let toolResult = null;

    if (decision.needs_tool && decision.tool) {
      const toolName = decision.tool;
      const toolParams = decision.tool_params || {};

      // Chiama l'endpoint del tool
      const toolUrl = `http://localhost:${PORT}/api/tools/${toolName}`;
      
      const toolResponse = await fetch(toolUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(toolParams)
      });

      if (!toolResponse.ok) {
        throw new Error(`Errore nel tool ${toolName}: ${toolResponse.statusText}`);
      }

      toolResult = await toolResponse.json();
    }

    // ==========================================
    // FASE 3: Gemini genera la risposta finale
    // ==========================================
    const finalPrompt = `
Sei un assistente finanziario personale esperto. Parli in italiano in modo chiaro e professionale.

Hai accesso ai dati reali del portafoglio dell'utente tramite dei tool.

Domanda dell'utente: "${userMessage}"

${toolResult ? `
Dati ottenuti dal tool (${decision.tool}):
${JSON.stringify(toolResult, null, 2)}

Usa questi dati per rispondere alla domanda dell'utente in modo preciso.
Non inventare numeri. Usa solo i dati forniti.
Spiega i risultati in modo chiaro, come se parlassi a un amico.
` : `
Questa domanda non richiede dati dal portafoglio. Rispondi in modo naturale e utile.
`}

Rispondi in italiano, in modo chiaro e diretto.
`.trim();

    const finalResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: finalPrompt,
      config: {
        systemInstruction: `
Sei un assistente finanziario personale. 
- Parli in italiano in modo chiaro e professionale.
- Spieghi i concetti in modo semplice, senza gergo inutile.
- Se ci sono dati numerici, li interpreti e spieghi cosa significano.
- Non inventi mai dati. Se non hai informazioni, lo dici chiaramente.
`.trim()
      }
    });

    const answer = finalResponse.text.trim();

    return res.json({
      question: userMessage,
      decision,
      tool_result: toolResult,
      answer
    });
  } catch (error) {
    console.error("Errore /api/chat:", error);
    return res.status(500).json({
      error: "Errore del server",
      details: error.message
    });
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pietro Portfolio disponibile sulla porta ${PORT}`);
});
