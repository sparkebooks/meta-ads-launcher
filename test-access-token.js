// Test Access Token and diagnose issues
require('dotenv').config();
const axios = require('axios');

async function testAccessToken() {
    console.log('🔍 Diagnosing Meta API Access...\n');

    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    console.log('1. Checking Access Token Info:');
    console.log(`   Token length: ${accessToken ? accessToken.length : 0} characters`);
    console.log(`   Ad Account ID: ${adAccountId}\n`);

    try {
        // Test 1: Check access token validity
        console.log('2. Testing Access Token Validity...');
        const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
        const debugResponse = await axios.get(debugUrl);

        const tokenData = debugResponse.data.data;
        console.log('✅ Token is valid');
        console.log(`   App ID: ${tokenData.app_id}`);
        console.log(`   Type: ${tokenData.type}`);
        console.log(`   Expires: ${tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never'}`);
        console.log(`   Scopes: ${tokenData.scopes ? tokenData.scopes.join(', ') : 'None listed'}\n`);

        // Test 2: Check Me endpoint
        console.log('3. Testing /me endpoint...');
        const meUrl = `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`;
        const meResponse = await axios.get(meUrl);
        console.log(`✅ User: ${meResponse.data.name} (ID: ${meResponse.data.id})\n`);

        // Test 3: Try both ad account formats
        console.log('4. Testing Ad Account Access...');

        // Try with act_ prefix
        const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        console.log(`   Trying with prefix: ${accountIdWithPrefix}`);

        try {
            const accountUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}?fields=id,name,account_status,currency&access_token=${accessToken}`;
            const accountResponse = await axios.get(accountUrl);

            console.log('✅ Ad Account Access Successful!');
            console.log(`   Account Name: ${accountResponse.data.name}`);
            console.log(`   Account Status: ${accountResponse.data.account_status}`);
            console.log(`   Currency: ${accountResponse.data.currency}`);
            console.log(`\n💡 Use this format in .env: META_AD_ACCOUNT_ID=${accountIdWithPrefix}\n`);

            // Test 4: Get campaigns
            console.log('5. Testing Campaigns Access...');
            const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/campaigns?fields=id,name,status&limit=5&access_token=${accessToken}`;
            const campaignsResponse = await axios.get(campaignsUrl);

            if (campaignsResponse.data.data && campaignsResponse.data.data.length > 0) {
                console.log(`✅ Found ${campaignsResponse.data.data.length} campaign(s):`);
                campaignsResponse.data.data.forEach((campaign, index) => {
                    console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
                });
            } else {
                console.log('ℹ️  No campaigns found');
            }

            console.log('\n🎉 All tests PASSED! Your Meta API is ready to use.');

        } catch (accountError) {
            console.log('❌ Ad Account Access Failed');
            console.log(`   Error: ${accountError.response?.data?.error?.message || accountError.message}`);

            // Try without prefix
            const accountIdWithoutPrefix = adAccountId.replace('act_', '');
            console.log(`\n   Trying without prefix: act_${accountIdWithoutPrefix}`);

            const accountUrl2 = `https://graph.facebook.com/v18.0/act_${accountIdWithoutPrefix}?fields=id,name,account_status&access_token=${accessToken}`;
            const accountResponse2 = await axios.get(accountUrl2);

            console.log('✅ Ad Account Access Successful!');
            console.log(`   Account Name: ${accountResponse2.data.name}`);
            console.log(`\n💡 Use this format in .env: META_AD_ACCOUNT_ID=act_${accountIdWithoutPrefix}\n`);
        }

    } catch (error) {
        console.log('\n❌ Test Failed!');

        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${error.response.data.error?.message || error.response.data}`);

            if (error.response.data.error?.code === 190) {
                console.log('\n💡 Token Issues:');
                console.log('   - Your access token is invalid or expired');
                console.log('   - Generate a new long-lived token at:');
                console.log('     https://developers.facebook.com/tools/explorer/');
                console.log('   - Required permissions: ads_management, ads_read, business_management');
            } else if (error.response.data.error?.code === 200) {
                console.log('\n💡 Permission Issues:');
                console.log('   - Your token does not have required permissions');
                console.log('   - Make sure to grant: ads_management, ads_read, business_management');
            } else if (error.response.status === 403) {
                console.log('\n💡 Access Denied:');
                console.log('   - Check that the ad account is linked to your app');
                console.log('   - Verify you have admin access to the ad account');
                console.log('   - Make sure the Business Manager settings allow API access');
            }
        } else {
            console.log(`   Error: ${error.message}`);
        }
    }
}

testAccessToken();
