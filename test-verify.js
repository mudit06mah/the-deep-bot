const { verifyKey } = require('discord-interactions');
try {
  verifyKey('body', 'invalidsig', 'timestamp', 'b49b5465fb4fcf19de17551bda303d99ce7e96d7266d19c198c643e77445f07e');
} catch (e) {
  console.log("It threw:", e.message);
}
