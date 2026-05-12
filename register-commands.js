require('dotenv').config({ path: '.env.local' });

const commands = [
  {
    name: 'ask-deep',
    description: 'Ask The Deep a question',
    options: [
      {
        name: 'message',
        description: 'What you want to say to The Deep',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_APP_ID;

if (!token || !appId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_APP_ID in .env.local");
  process.exit(1);
}

async function registerCommands() {
  console.log('Started refreshing application (/) commands.');
  
  const response = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${token}`,
    },
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log('Successfully registered command.');
  } else {
    const error = await response.text();
    console.error('Failed to register command:', error);
  }
}

registerCommands();
