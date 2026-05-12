import { NextResponse, after } from 'next/server';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import Groq from 'groq-sdk';

// Use Node.js runtime — more reliable on Vercel free tier than Edge for this use case
export const dynamic = 'force-dynamic';

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
  console.log('[Deep Bot] Received POST request');

  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const rawBody = await req.text();

  console.log('[Deep Bot] Signature present:', !!signature);
  console.log('[Deep Bot] Timestamp present:', !!timestamp);
  console.log('[Deep Bot] Public key configured:', !!process.env.DISCORD_PUBLIC_KEY);

  if (!signature || !timestamp) {
    console.log('[Deep Bot] Missing signature or timestamp');
    return new NextResponse('Missing signature', { status: 401 });
  }

  // Verify the request is actually from Discord
  const isValidRequest = verifyKey(
    rawBody,
    signature,
    timestamp,
    process.env.DISCORD_PUBLIC_KEY!
  );

  if (!isValidRequest) {
    console.log('[Deep Bot] Invalid signature');
    return new NextResponse('Bad request signature', { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  console.log('[Deep Bot] Interaction type:', interaction.type);

  // Handle Discord's verification PING (Type 1)
  // This MUST succeed for Discord to accept the Interactions Endpoint URL
  if (interaction.type === InteractionType.PING) {
    console.log('[Deep Bot] Responding to PING');
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // Handle Slash Commands (Type 2)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    console.log('[Deep Bot] Command:', interaction.data.name);

    let userInput = 'Talk to me';
    if (interaction.data.options && interaction.data.options.length > 0) {
      const option = interaction.data.options.find((opt: any) => opt.name === 'message');
      if (option) {
        userInput = option.value;
      }
    }

    console.log('[Deep Bot] User input:', userInput);

    // Immediately tell Discord "I'm thinking..." (Type 5)
    // This buys us up to 15 minutes to follow up
    const deferredResponse = NextResponse.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });

    // Now do the actual Groq work and follow up via webhook
    // We DON'T await this — it runs after we return the deferred response
    const followUp = async () => {
      try {
        console.log('[Deep Bot] Calling Groq...');
        const groq = new Groq({ apiKey: process.env.GROQ_TOKEN });

        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userInput },
          ],
          model: 'llama3-8b-8192',
          temperature: 0.9,
          max_tokens: 300,
        });

        const reply =
          chatCompletion.choices[0]?.message?.content ||
          'I have nothing to say to you, civilian.';

        console.log('[Deep Bot] Got Groq reply, updating Discord message...');

        // Edit the original deferred message with the actual reply
        const patchUrl = `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: reply }),
        });

        console.log('[Deep Bot] Discord PATCH status:', patchRes.status);
      } catch (error) {
        console.error('[Deep Bot] Error:', error);
        try {
          await fetch(
            `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APP_ID}/${interaction.token}/messages/@original`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content:
                  "Sorry bro, the ocean is acting up right now. I'm busy meditating with the salmon.",
              }),
            }
          );
        } catch (e) {
          console.error('[Deep Bot] Failed to send error message:', e);
        }
      }
    };

    // after() tells Vercel to keep the function alive after returning the response
    // Without this, the serverless function gets killed before followUp() completes
    after(followUp);

    return deferredResponse;
  }

  return new NextResponse('Unknown interaction type', { status: 400 });
}
