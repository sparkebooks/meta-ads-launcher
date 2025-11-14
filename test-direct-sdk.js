// Test using the Facebook SDK directly (same as our app uses)
require('dotenv').config();
const { FacebookAdsApi, AdAccount } = require('facebook-nodejs-business-sdk');

async function testSDK() {
    console.log('🧪 Testing Facebook Business SDK directly...\n');

    try {
        console.log('1. Initializing SDK...');
        const accessToken = process.env.META_ACCESS_TOKEN;
        console.log(`   Token length: ${accessToken.length}`);
        console.log(`   Token starts: ${accessToken.substring(0, 20)}...`);

        FacebookAdsApi.init(accessToken);
        console.log('✅ SDK initialized\n');

        console.log('2. Testing Ad Account access...');
        const accountId = process.env.META_AD_ACCOUNT_ID;
        console.log(`   Account ID: ${accountId}`);

        const account = new AdAccount(accountId);

        // Try to read basic account info
        const accountData = await account.read([
            'account_id',
            'name',
            'account_status',
            'currency'
        ]);

        console.log('✅ SUCCESS! Ad Account accessible:\n');
        console.log(`   Account ID: ${accountData.account_id}`);
        console.log(`   Name: ${accountData.name}`);
        console.log(`   Status: ${accountData.account_status}`);
        console.log(`   Currency: ${accountData.currency}`);

        console.log('\n3. Testing campaigns list...');
        const campaigns = await account.getCampaigns(['id', 'name', 'status'], { limit: 5 });

        if (campaigns && campaigns.length > 0) {
            console.log(`✅ Found ${campaigns.length} campaign(s):`);
            campaigns.forEach((campaign, idx) => {
                console.log(`   ${idx + 1}. ${campaign.name} (${campaign.status})`);
            });
        } else {
            console.log('ℹ️  No campaigns found (this is normal for new accounts)');
        }

        console.log('\n🎉 All tests PASSED! Meta API is working correctly.');
        console.log('Ready to test bulk ad creation!\n');

    } catch (error) {
        console.error('\n❌ Test Failed!');
        console.error('Error:', error.message);

        if (error.message.includes('OAuth')) {
            console.log('\n💡 Token issue - but your token works in Graph Explorer...');
            console.log('   This might be a Business Manager permission issue.');
        } else if (error.message.includes('Unsupported get request')) {
            console.log('\n💡 Account ID format issue');
            console.log(`   Current: ${process.env.META_AD_ACCOUNT_ID}`);
            console.log('   Try: act_598734841906435 (with act_ prefix)');
        } else {
            console.log('\nFull error:', error);
        }
    }
}

testSDK();
