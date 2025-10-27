// Test what ad accounts are accessible with this token
require('dotenv').config();
const axios = require('axios');

async function testAdAccounts() {
    console.log('🔍 Finding accessible ad accounts...\n');

    const accessToken = process.env.META_ACCESS_TOKEN;

    try {
        // Get the user's info first
        console.log('1. Getting user info...');
        const meUrl = `https://graph.facebook.com/v19.0/me?access_token=${accessToken}`;
        const meResponse = await axios.get(meUrl);
        console.log(`✅ User: ${meResponse.data.name} (ID: ${meResponse.data.id})\n`);

        // Get ad accounts the user has access to
        console.log('2. Getting accessible ad accounts...');
        const accountsUrl = `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`;
        const accountsResponse = await axios.get(accountsUrl);

        if (accountsResponse.data.data && accountsResponse.data.data.length > 0) {
            console.log(`✅ Found ${accountsResponse.data.data.length} ad account(s):\n`);

            accountsResponse.data.data.forEach((account, index) => {
                console.log(`${index + 1}. ${account.name}`);
                console.log(`   ID: ${account.id}`);
                console.log(`   Status: ${account.account_status}`);
                console.log(`   Currency: ${account.currency}`);
                console.log(`   Timezone: ${account.timezone_name || 'N/A'}`);
                console.log('');
            });

            console.log('💡 Copy one of these IDs above and use it as META_AD_ACCOUNT_ID in your .env file');

            // Test the current configured account
            console.log('\n3. Testing your configured account (act_598734841906435)...');
            const currentAccountUrl = `https://graph.facebook.com/v19.0/act_598734841906435?fields=id,name,account_status&access_token=${accessToken}`;

            try {
                const currentResponse = await axios.get(currentAccountUrl);
                console.log('✅ Your configured account is accessible!');
                console.log(`   Name: ${currentResponse.data.name}`);
                console.log(`   Status: ${currentResponse.data.account_status}`);
            } catch (err) {
                console.log('❌ Your configured account (act_598734841906435) is NOT accessible');
                console.log(`   Error: ${err.response?.data?.error?.message || err.message}`);
                console.log('\n💡 Use one of the account IDs listed above instead.');
            }

        } else {
            console.log('❌ No ad accounts found for this user');
            console.log('\n💡 Possible issues:');
            console.log('   - You may not have access to any ad accounts');
            console.log('   - The token may not have business_management permission');
            console.log('   - You need to be added to an ad account in Business Manager');
        }

    } catch (error) {
        console.log('\n❌ Test Failed!');
        console.log(`Error: ${error.response?.data?.error?.message || error.message}`);

        if (error.response?.data?.error?.code === 190) {
            console.log('\n💡 Token is invalid or expired. Generate a new one.');
        }
    }
}

testAdAccounts();
