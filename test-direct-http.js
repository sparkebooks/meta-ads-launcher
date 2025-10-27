// Test using direct HTTP calls (bypassing the SDK)
require('dotenv').config();
const axios = require('axios');

async function testDirectHTTP() {
    console.log('🧪 Testing Meta API with direct HTTP calls...\n');

    const accessToken = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.META_AD_ACCOUNT_ID;

    try {
        console.log('1. Testing /me endpoint...');
        const meUrl = `https://graph.facebook.com/v19.0/me?access_token=${accessToken}`;
        const meResponse = await axios.get(meUrl);
        console.log(`✅ User: ${meResponse.data.name} (ID: ${meResponse.data.id})\n`);

        console.log('2. Testing ad account access...');
        const accountUrl = `https://graph.facebook.com/v19.0/${accountId}?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`;
        const accountResponse = await axios.get(accountUrl);

        console.log('✅ Ad Account Details:');
        console.log(`   ID: ${accountResponse.data.id}`);
        console.log(`   Name: ${accountResponse.data.name}`);
        console.log(`   Status: ${accountResponse.data.account_status}`);
        console.log(`   Currency: ${accountResponse.data.currency}`);
        console.log(`   Timezone: ${accountResponse.data.timezone_name || 'N/A'}\n`);

        console.log('3. Testing campaigns list...');
        const campaignsUrl = `https://graph.facebook.com/v19.0/${accountId}/campaigns?fields=id,name,status&limit=5&access_token=${accessToken}`;
        const campaignsResponse = await axios.get(campaignsUrl);

        if (campaignsResponse.data.data && campaignsResponse.data.data.length > 0) {
            console.log(`✅ Found ${campaignsResponse.data.data.length} campaign(s):`);
            campaignsResponse.data.data.forEach((campaign, idx) => {
                console.log(`   ${idx + 1}. ${campaign.name} (${campaign.status}) - ID: ${campaign.id}`);
            });
        } else {
            console.log('ℹ️  No campaigns found\n');
        }

        console.log('\n🎉 Direct HTTP calls work! The issue is with the Facebook SDK.');
        console.log('💡 We can use direct HTTP calls for bulk ad creation instead.\n');

        return true;

    } catch (error) {
        console.error('\n❌ Direct HTTP Test Failed!');

        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data.error?.message || error.response.data}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }

        return false;
    }
}

testDirectHTTP();
