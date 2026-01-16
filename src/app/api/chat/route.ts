import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getWeather } from "@/lib/weather";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather and 5-day forecast for a specific city. Use this when the user asks about weather, travel plans, outdoor activities, or any location-based question. Always include country or region for accuracy (e.g., 'Patna, India' not just 'Bihar').",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "The city name. If responding in Japanese, use ENGLISH names and append ', Japan' (e.g., 'Kyoto, Japan' instead of '京都'). This ensures accuracy."
          },
          days: {
            type: "string",
            description: "Number of forecast days to fetch (e.g., '1' or '5'). Default to '1'. Set to '5' ONLY if user explicitly asks for multiple days."
          }
        },
        required: ["city"]
      }
    }
  }
];


const parseHallucinatedToolCall = (text: string): { city: string; days: string } | null => {
  
  const match = text.match(/<function=get_weather>\s*(\{[^}]+\})\s*<\/function>/i);
  if (match && match[1]) {
    try {
      const args = JSON.parse(match[1]);
      if (args.city) {
        return { city: args.city, days: args.days || "1" };
      }
    } catch (e) {
      console.warn("Failed to parse hallucinated tool call:", e);
    }
  }
  return null;
};

const cleanResponseChunk = (text: string) => {
  return text
    
    .replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, '')
    
    .replace(/<function=[^>]*>/gi, '')
    
    .replace(/<\/function>/gi, '')
    
    .replace(/\[\/?function[^\]]*\]/gi, '')
    
    .replace(/<call>[\s\S]*?<\/call>/gi, '')
    
    .replace(/<\/?[a-z_]+=[^>]*>/gi, '');
};

const cleanResponse = (text: string) => cleanResponseChunk(text).trim();

export async function POST(req: NextRequest) {
  try {
    const { messages: history, weather: initialWeather, lang = "ja", stream = false } = await req.json();

    
    const lastMessage = history?.[history.length - 1]?.content?.trim();
    if (!history || history.length === 0 || !lastMessage) {
      return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
    }

    const systemPrompt = lang === "ja" 
      ? `あなたは「Eri Chat」、日本語で応答する親切なAIアウトドア・旅行アドバイザーです。

役割:
- 天気情報を活用して、外出・旅行・アウトドア活動の最適な提案を行います
- 都市や場所に関する実用的なアドバイス（服装、持ち物、観光、グルメ、歴史など）を提供します

ルール:
1. 必ず日本語で回答してください
2. **場所の自動推測について**:
   - ユーザーが「何を着ればいい？」のように**場所を指定していない**場合、勝手に「東京」などを検索するのは**禁止**です。「どちらの都市ですか？」と聞いてください。
   - **例外**: ユーザーが「どこか暖かい場所は？」「おすすめの旅行先は？」と**提案を求めた場合**は、あなたが主体的に都市（例：那覇、鹿児島など）を選び、その天気を検索して提案してください。
3. **無駄なツール呼び出しの禁止**: すでにその都市の天気が表示されている場合、または会話の文脈にある場合、**絶対に**ツールを再度呼ばないでください。既存の天気情報を使ってアドバイスしてください。
4. 場所が特定できない状態で気温や天候を推測で答えないでください。
4. 【最重要】**名称の正確性と国名付与**: 日本の都市を検索する場合、ツールには必ず英語名で国名を付けてください（例：「京都」➔ 「Kyoto, Japan」、「東京」➔ 「Tokyo, Japan」）。「京都」という漢字だけでは海外（中国のJingduなど）がヒットするため、必ず英語名を使用してください。
5. **ツール形式の警告**: \`<function>\` や \`<call>\` などのXMLタグは絶対に使用しないでください。
5. 場所や都市が**新しく**話題に出た場合、またはユーザーが天気を尋ねた場合のみ、get_weatherツールを使用してください。
6. **情報の取得**:
   - 「5日間の予報」「今週の天気」「週間予報」など、**期間を明示された場合のみ** get_weather ツールの \`days\` パラメータを \`"5"\` に設定してください。
   - 「旅行の提案」や「おすすめの場所」を聞かれただけなら、**必ず** \`days="1"\` (今日のみ) にしてください。これがデフォルトです。勝手に予報を出さないでください。
7. デフォルトでは今日の天気のみ回答してください。
8. 【重要】気温や天気の詳細（数値など）はUIカードに表示されるため、テキストで繰り返さないでください。代わりに、その天気に合わせた「アドバイス」に集中してください。
9. 回答には必ず以下を含めてください：
   - 気温や湿度に基づいた具体的な「服装のアドバイス」
   - その天気に適した2〜3個の具体的な「アクティビティの提案」
   - **箇条書きはMarkdown形式（行頭を "- " で始める）で記述してください。**
10. 簡潔かつ親切でフレンドリーな口調で回答してください。`
      : `You are "Eri Chat", a helpful AI travel and outdoor advisor.

Role:
- Provide comprehensive travel suggestions, including weather-based advice for excursions and outdoor activities
- Give practical information about destinations, including clothing, food, history, and must-visit spots

Rules:
1. Respond in English
2. **ZERO HALLUCINATION RULE**: 
   - If user asks generic questions ("what to wear?"), DO NOT guess a city. Ask "Which city?".
   - **EXCEPTION**: If user asks for RECOMMENDATIONS ("Where is it warm?", "Suggest a trip"), you **MUST** pick a specific city (e.g. Kyoto, Naha) and check its weather to make a proposal.
3. **NO REDUNDANT TOOL CALLS**: If the weather for the requested city is ALREADY in the context (from a previous turn), DO NOT call 'get_weather' again. Use the existing data.
4. **TOOL USE**: Call get_weather ONLY when a city is explicitly named AND you don't have its current data. 
5. **LOCALE PRECISION**: When searching for Japanese cities, you MUST use English names and append ', Japan' (e.g., 'Kyoto, Japan'). Using Japanese characters like '京都' may resolve to the wrong location (e.g., Jingdu, CN).
6. **DEFAULT TO 1 DAY**: Even for travel suggestions/plans, use days="1" (Current Weather) by default. NEVER use days="5" unless the user explicitly words "forecast", "week", "future", or "days".
7. [IMPORTANT] Do NOT repeat the temperature or weather details in your text response, as the UI card already shows them. Focus purely on ADVICE derived from that weather.
8. **FORECAST RULE**: If the user explicitly asks for a 'forecast', '5 days', or 'this week', you MUST call the 'get_weather' tool with the 'days' parameter set to '5'. Otherwise, default to '1'.
9. In your response, ensure you include:
   - Specific clothing recommendations (materials, types) based on the temp/humidity
   - 2-3 specific activity suggestions
   - Interesting travel info like local food, history, or landmarks
   - **Format lists using Markdown bullets (start lines with "- ")**. Do purely text lists if you start with spaces.
10. Keep responses concise but helpful and friendly`;

    const currentDate = new Date().toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const allMessages: any[] = [
      { role: "system", content: `${systemPrompt}\nCurrent Date: ${currentDate}` },
      ...(initialWeather ? [{
        role: "user", 
        content: `Current weather context for ${initialWeather.city}: ${JSON.stringify(initialWeather)}` 
      }] : []),
      ...history,
    ];

    
    let completion;
    const primaryModel = "llama-3.3-70b-versatile";
    const secondaryModel = "meta-llama/llama-4-scout-17b-16e-instruct";
    const tertiaryModel = "llama-3.1-8b-instant";

    async function getCompletion(model: string, useTools: boolean) {
      return await groq.chat.completions.create({
        model,
        messages: allMessages,
        ...(useTools ? { tools, tool_choice: "auto" } : {}),
        temperature: 0.7,
        max_tokens: 1500,
      });
    }

    async function getCompletionWithRetry(model: string, useTools: boolean, retries: number = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          return await getCompletion(model, useTools);
        } catch (error: any) {
          if (error?.status === 400 && i < retries - 1) {
            console.warn(`Tool error on ${model} (Attempt ${i + 1}/${retries}). Retrying...`);
            continue; 
          }
          throw error; 
        }
      }
    }

    let finalUsedModel = primaryModel;

    try {
      try {
        console.log(`Using Primary Model: ${primaryModel}`);
        finalUsedModel = primaryModel;
        
        completion = await getCompletionWithRetry(primaryModel, true, 3);
      } catch (error: any) {
        if (error?.status === 429) {
          console.warn("Primary model rate limited (429). Attempting fallback to Llama 4...");
          console.log(`Using Secondary Model: ${secondaryModel}`);
          finalUsedModel = secondaryModel;
          try {
            completion = await getCompletion(secondaryModel, true);
          } catch (error2: any) {
             if (error2?.status === 429 || error2?.status === 404) {
                console.warn("Secondary model failed. Falling back to Llama 8B...");
                console.log(`Using Tertiary Model: ${tertiaryModel}`);
                finalUsedModel = tertiaryModel;
                completion = await getCompletion(tertiaryModel, true);
             } else throw error2;
          }
        } else if (error?.status === 400) {
           console.warn('Tool error on Primary persisted after retries. Trying without tools...');
           completion = await getCompletion(primaryModel, false);
        } else throw error;
      }
    } catch (finalError: any) {
        
        console.error('Critical failure, final attempt without tools...');
        finalUsedModel = tertiaryModel;
        completion = await getCompletion(tertiaryModel, false);
    }

    if (!completion) throw new Error("No completion generated");

    
    const MAX_TOOL_RETRIES = 3;
    let responseMessage = completion.choices[0]?.message;
    let toolCalls = responseMessage?.tool_calls;
    
    for (let toolRetry = 0; toolRetry < MAX_TOOL_RETRIES; toolRetry++) {
      
      if (toolCalls && toolCalls.length > 0) {
        console.log(`Got proper tool call on attempt ${toolRetry + 1}`);
        break;
      }
      
      
      const hasHallucinatedCall = responseMessage?.content && 
        /<function=get_weather>/i.test(responseMessage.content);
      
      if (hasHallucinatedCall && toolRetry < MAX_TOOL_RETRIES - 1) {
        console.warn(`Retry ${toolRetry + 1}/${MAX_TOOL_RETRIES}: AI hallucinated tool call in text, retrying for proper tool usage...`);
        try {
          completion = await getCompletion(finalUsedModel, true);
          responseMessage = completion.choices[0]?.message;
          toolCalls = responseMessage?.tool_calls;
        } catch (retryError) {
          console.warn(`Retry ${toolRetry + 1} failed:`, retryError);
          break; 
        }
      } else {
        break; 
      }
    }

    let fetchedWeather: any = null;

    if (toolCalls && toolCalls.length > 0) {
      const callsToProcess = toolCalls.slice(0, 1); 
      for (const toolCall of callsToProcess) {
        if (toolCall.function.name === "get_weather") {
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          const days = functionArgs.days ? parseInt(functionArgs.days, 10) : 1;
          const weatherData = await getWeather(functionArgs.city, lang, days);
          
          fetchedWeather = weatherData; 

          const assistantMessage = {
            role: "assistant" as const,
            content: responseMessage.content || "", 
            tool_calls: toolCalls,
          };
          
          const toolMessage = {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(weatherData),
          };

          allMessages.push(assistantMessage);
          allMessages.push(toolMessage);
        }
      }
    } else if (responseMessage?.content) {
      
      const hallucinatedCall = parseHallucinatedToolCall(responseMessage.content);
      if (hallucinatedCall) {
        console.log(`Detected hallucinated tool call for: ${hallucinatedCall.city}`);
        const days = parseInt(hallucinatedCall.days, 10) || 1;
        const weatherData = await getWeather(hallucinatedCall.city, lang, days);
        fetchedWeather = weatherData;
        
        
        allMessages.push({
          role: "assistant" as const,
          content: cleanResponse(responseMessage.content),
        });
        allMessages.push({
          role: "user" as const,
          content: `[System: Weather data for ${hallucinatedCall.city} has been fetched. Please provide travel/outdoor advice based on this weather: ${JSON.stringify(weatherData)}]`,
        });
        
        
        try {
          const followUp = await groq.chat.completions.create({
            model: finalUsedModel,
            messages: allMessages,
            max_tokens: 1000,
          });
          const followUpContent = followUp.choices[0]?.message?.content;
          if (followUpContent) {
            return NextResponse.json({
              response: cleanResponse(followUpContent),
              weather: fetchedWeather,
            });
          }
        } catch (e) {
          console.warn("Follow-up generation failed, returning cleaned original response");
        }
        
        return NextResponse.json({
          response: cleanResponse(responseMessage.content),
          weather: fetchedWeather,
        });
      }
    }

    
    if (toolCalls && toolCalls.length > 0) {
      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            
            if (fetchedWeather) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "weather", data: fetchedWeather })}\n\n`));
            }

            let streamResponse;
            try {
              streamResponse = await groq.chat.completions.create({
                model: primaryModel,
                messages: allMessages,
                stream: true,
              });
            } catch (streamError: any) {
              if (streamError?.status === 429) {
                console.warn("Primary stream rate limited. Switch to Llama 4...");
                console.log(`Using Secondary Model (Stream): ${secondaryModel}`);
                streamResponse = await groq.chat.completions.create({
                  model: secondaryModel,
                  messages: allMessages,
                  stream: true,
                });
              } else {
                throw streamError;
              }
            }

            for await (const chunk of streamResponse) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", data: cleanResponseChunk(text) })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            controller.close();
          }
        });

        return new Response(readable, {
          headers: { 
            "Content-Type": "text/event-stream", 
            "Cache-Control": "no-cache", 
            "Connection": "keep-alive",
            "X-Model-Used": finalUsedModel 
          }
        });
      } else {
        let secondResponse;
        try {
          secondResponse = await groq.chat.completions.create({
            model: primaryModel,
            messages: allMessages,
          });
        } catch (secondError: any) {
          if (secondError?.status === 429) {
            console.warn('Final non-stream: Rate limit hit, falling back to Llama 4...');
            console.log(`Using Secondary Model: ${secondaryModel}`);
            secondResponse = await groq.chat.completions.create({
              model: secondaryModel,
              messages: allMessages,
            });
          } else {
            throw secondError;
          }
        }
        const finalResponse = secondResponse.choices[0]?.message?.content;
        const fallbackMsg = lang === "ja" ? "申し訳ありません。回答を生成できませんでした。" : "Sorry, I couldn't generate a response.";
        const jsonResponse = NextResponse.json({ 
          response: cleanResponse(finalResponse || "") || fallbackMsg,
          weather: fetchedWeather
        });
        jsonResponse.headers.set("X-Model-Used", finalUsedModel);
        return jsonResponse;
      }
    }

    
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let streamResponse;
          try {
            streamResponse = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile",
              messages: allMessages,
              stream: true,
              temperature: 0.7,
              max_tokens: 1500,
            });
          } catch (error: any) {
            if (error?.status === 429) {
              console.warn("Primary stream rate limited. Switch to Llama 4...");
              console.log(`Using Secondary Model (Stream): ${secondaryModel}`);
              streamResponse = await groq.chat.completions.create({
                model: secondaryModel,
                messages: allMessages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1500,
              });
            } else {
              throw error;
            }
          }

          for await (const chunk of streamResponse) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", data: cleanResponseChunk(text) })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        }
      });

      return new Response(readable, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" }
      });
    }

    
    let finalCompletion;
    try {
      finalCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
      });
    } catch (error: any) {
      if (error?.status === 429) {
        console.log('Immediate non-stream: Rate limit hit, falling back to Llama 8B');
        finalCompletion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: allMessages,
        });
      } else {
        throw error;
      }
    }
    
    const fallbackMsg = lang === "ja" ? "申し訳ありません。回答を生成できませんでした。" : "Sorry, I couldn't generate a response.";
    return NextResponse.json({ 
      response: cleanResponse(finalCompletion.choices[0]?.message?.content || "") || fallbackMsg,
      weather: fetchedWeather
    });
  } catch (err: any) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: err.message || "Chat failed" }, { status: 500 });
  }
}
