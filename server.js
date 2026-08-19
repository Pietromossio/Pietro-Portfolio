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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pietro Portfolio disponibile sulla porta ${PORT}`);
});