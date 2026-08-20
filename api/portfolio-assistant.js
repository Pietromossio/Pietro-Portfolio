import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Metodo non consentito'
    });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Token di accesso mancante'
      });
    }

    const {
      data: { user },
      error: userError
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: 'Sessione non valida. Accedi nuovamente.'
      });
    }

    const question = String(req.body?.question || '').trim();

    if (!question) {
      return res.status(400).json({
        error: 'Inserisci una domanda.'
      });
    }

    const { data: holdings, error: holdingsError } =
      await supabaseAdmin
        .from('holdings')
        .select('*')
        .eq('user_id', user.id);

    if (holdingsError) throw holdingsError;

    const { data: transactions, error: transactionsError } =
      await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);

    if (transactionsError) throw transactionsError;

    const positions = (holdings || []).map(item => {
      const quantity = Number(item.quantity || 0);
      const averagePrice = Number(item.average_price || 0);
      const currentPrice = Number(
        item.price ?? item.average_price ?? 0
      );

      const invested = quantity * averagePrice;
      const currentValue = quantity * currentPrice;
      const profitLoss = currentValue - invested;

      return {
        name: item.name,
        platform: item.platform || 'Non indicata',
        type: item.type || 'Non indicato',
        symbol: item.crypto || item.isin || null,
        quantity,
        averagePrice,
        currentPrice,
        invested,
        currentValue,
        profitLoss,
        profitLossPct: invested > 0
          ? (profitLoss / invested) * 100
          : 0
      };
    });

    const invested = positions.reduce(
      (sum, item) => sum + item.invested,
      0
    );

    const currentValue = positions.reduce(
      (sum, item) => sum + item.currentValue,
      0
    );

    const profitLoss = currentValue - invested;

    const analysisData = {
      generatedAt: new Date().toISOString(),
      portfolio: {
        invested,
        currentValue,
        profitLoss,
        profitLossPct: invested > 0
          ? (profitLoss / invested) * 100
          : 0
      },
      positions,
      transactions: transactions || []
    };

    const prompt = `
Sei Portfolio AI, assistente personale di analisi del portafoglio.
Rispondi sempre in italiano, in modo chiaro e sintetico.

REGOLE OBBLIGATORIE:
- Usa esclusivamente il contesto fornito.
- Non inventare dati, prezzi, rendimenti o transazioni.
- Se una risposta richiede uno storico non presente, spiegalo chiaramente.
- Distingui rendimento non realizzato e rendimento realizzato.
- Mostra cifre in euro con due decimali.
- Per analisi di rischio o diversificazione, descrivi i limiti dei dati.
- Non fornire consulenza finanziaria personalizzata o garanzie.
- Chiudi con: "Analisi informativa, non consulenza finanziaria."

DOMANDA:
${question}

CONTESTO PORTAFOGLIO:
${JSON.stringify(analysisData)}
`;

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
        encodeURIComponent(process.env.GEMINI_API_KEY),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const geminiJson = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini error:', geminiJson);

      throw new Error(
        geminiJson?.error?.message ||
        'Gemini non ha potuto generare una risposta.'
      );
    }

    const answer =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!answer) {
      throw new Error('L’assistente non ha restituito una risposta.');
    }

    return res.status(200).json({
      type: 'answer',
      answer,
      metrics: {
        invested,
        currentValue,
        profitLoss,
        profitLossPct: invested > 0
          ? (profitLoss / invested) * 100
          : 0
      }
    });
  } catch (error) {
    console.error('Portfolio assistant error:', error);

    return res.status(500).json({
      error: error.message || 'Errore interno dell’assistente.'
    });
  }
}
