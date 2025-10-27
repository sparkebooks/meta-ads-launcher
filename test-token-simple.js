// Simple direct test without SDK
require('dotenv').config();

console.log('🔍 Token Check:\n');
console.log('Token from .env:', process.env.META_ACCESS_TOKEN);
console.log('Token length:', process.env.META_ACCESS_TOKEN?.length);
console.log('Token starts with:', process.env.META_ACCESS_TOKEN?.substring(0, 20));
console.log('\nExpected token starts with: EAAXqZCooBNBYBPy6lFr');
console.log('\nDo they match?', process.env.META_ACCESS_TOKEN?.startsWith('EAAXqZCooBNBYBPy6lFr'));
