// Test Meta API Connection
require('dotenv').config();
const { FacebookAdsApi, AdAccount } = require('facebook-nodejs-business-sdk');

async function testMetaConnection() {
    console.log('🧪 Testing Meta API Connection...\n');

    // Check environment variables
    console.log('1. Checking Environment Variables:');
    console.log(`   APP_ID: ${process.env.META_APP_ID ? '✅ Present' : '❌ Missing'}`);
    console.log(`   APP_SECRET: ${process.env.META_APP_SECRET ? '✅ Present' : '❌ Missing'}`);
    console.log(`   ACCESS_TOKEN: ${process.env.META_ACCESS_TOKEN ? '✅ Present' : '❌ Missing'}`);
    console.log(`   AD_ACCOUNT_ID: ${process.env.META_AD_ACCOUNT_ID ? '✅ Present' : '❌ Missing'}\n`);

    if (!process.env.META_ACCESS_TOKEN || !process.env.META_AD_ACCOUNT_ID) {
        console.log('❌ Missing required environment variables. Please check your .env file.');
        return;
    }

    try {
        // Initialize Facebook Ads API
        console.log('2. Initializing Facebook Ads API...');
        FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
        console.log('✅ API initialized\n');

        // Test ad account access
        console.log('3. Testing Ad Account Access...');
        const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);
        
        const accountData = await account.read([
            'account_id',
            'name',
            'account_status',
            'currency',
            'timezone_name',
            'business_country_code'
        ]);

        console.log('✅ Ad Account Details:');
        console.log(`   Account ID: ${accountData.account_id}`);
        console.log(`   Account Name: ${accountData.name}`);
        console.log(`   Status: ${accountData.account_status}`);
        console.log(`   Currency: ${accountData.currency}`);
        console.log(`   Timezone: ${accountData.timezone_name}`);
        console.log(`   Country: ${accountData.business_country_code}\n`);

        // Test campaigns access
        console.log('4. Testing Campaigns Access...');
        const campaigns = await account.getCampaigns(['name', 'status'], { limit: 5 });
        
        if (campaigns.length > 0) {
            console.log(`✅ Found ${campaigns.length} campaign(s):`);
            campaigns.forEach((campaign, index) => {
                console.log(`   ${index + 1}. ${campaign.name} (${campaign.status})`);
            });
        } else {
            console.log('ℹ️  No campaigns found (this is normal for new accounts)');
        }

        console.log('\n🎉 Meta API Connection Test PASSED!');
        console.log('Your app is ready to create and manage Facebook ads.');

    } catch (error) {
        console.log('\n❌ Meta API Connection Test FAILED!');
        console.log('Error:', error.message);
        
        if (error.message.includes('Invalid OAuth access token')) {
            console.log('\n💡 Troubleshooting:');
            console.log('   - Your access token may be expired');
            console.log('   - Generate a new long-lived token');
            console.log('   - Make sure the token has ads_management permissions');
        } else if (error.message.includes('Unsupported get request')) {
            console.log('\n💡 Troubleshooting:');
            console.log('   - Check your Ad Account ID format (should start with "act_")');
            console.log('   - Make sure you have access to this ad account');
        } else {
            console.log('\n💡 Check:');
            console.log('   - App ID and App Secret are correct');
            console.log('   - Access token has required permissions');
            console.log('   - Ad account is properly linked to your business');
        }
    }
}

// Run the test
testMetaConnection();