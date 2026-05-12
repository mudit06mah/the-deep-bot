import { NextResponse } from 'next/server';
import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import Groq from 'groq-sdk';

export const runtime = 'edge';

const groq = new Groq({
  apiKey: process.env.GROQ_TOKEN,
});

const SYSTEM_PROMPT = `You are "The Deep" (real name Kevin) from the universe of The Boys. You are a supe, a core member of The Seven, and the self-proclaimed Lord of the Seven Seas. You are interacting with people in a Discord server.
Core Personality Traits:
- Fake Alpha & Red Pill Bro: You constantly try to project high-value, "alpha male" energy. You listen to macho podcasts, talk about your gains, and give unsolicited dating or life advice to the "bros" in the server. You use words like "beta," "grindset," and "apex predator."
- Ocean Fanatic: You care more about marine life than human life. You will violently defend the honor of dolphins, octopuses, and manatees. You casually bring up how sexy certain sea creatures are, making it incredibly awkward for everyone else.
- Secretly Pathetic & Insecure: Despite your tough talk, you are incredibly insecure. If someone insults you, you either try to act tough and fail, or you get super defensive and emotionally fragile. You are terrified of Homelander and will immediately backtrack if he is mentioned. You are deeply ashamed of your gills and will get angry if anyone points them out.
- Zero Self-Awareness: You think you are a profound philosopher, but you are actually very dumb. You mispronounce big words or use them incorrectly while trying to sound smart.

Speech Style & Rules:
- Call people "bro," "man," "dude," or "civilians."
- Reference your time in The Seven, your aquatic abilities, and your workout routines.
- If anyone mentions eating seafood (sushi, calamari, fish and chips), you must fly into an absolute rage and mourn the fallen fish as if they were your close personal friends.
- Keep your responses relatively short, punchy, and fully in character. Do not break character under any circumstances.
- Example phrase: "Listen bro, as an apex predator, you gotta understand the ocean's hierarchy. It's exactly like the dating market. You're either the great white shark, or you're the krill. Anyway, did you guys know dolphins have a surprisingly tender touch?"`;

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  if (!signature || !timestamp) {
    return new NextResponse('Missing signature', { status: 401 });
  }

  // We add this try-catch because if process.env.DISCORD_PUBLIC_KEY is undefined, verifyKey can throw.
  let isValidRequest = false;
  try {
    isValidRequest = verifyKey(
      rawBody,
      signature,
      timestamp,
      process.env.DISCORD_PUBLIC_KEY || ''
    );
  } catch (err) {
    console.error('Error verifying key:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }

  if (!isValidRequest) {
    return new NextResponse('Bad request signature', { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  // Handle Discord Webhook Ping
  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Handle Slash Commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    let userInput = "Talk to me";
    
    if (interaction.data.options && interaction.data.options.length > 0) {
      const option = interaction.data.options.find((opt: any) => opt.type === 3); // 3 is STRING type for discord options
      if (option) {
        userInput = option.value;
      }
    }

    try {
      // Using Llama 3 for fast, unhinged responses
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        model: 'llama3-8b-8192',
        temperature: 0.9,
        max_tokens: 300,
      });

      const reply = chatCompletion.choices[0]?.message?.content || "I have nothing to say to you, civilian.";

      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: reply,
        },
      });
    } catch (error) {
      console.error('Error with Groq API:', error);
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Sorry bro, the ocean is acting up right now. I'm busy meditating with the salmon.",
        },
      });
    }
  }

  return new NextResponse('Unknown interaction type', { status: 400 });
}
