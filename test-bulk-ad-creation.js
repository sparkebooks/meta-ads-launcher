/**
 * Test Bulk Ad Creation
 *
 * This script tests the automated bulk ad creation system by:
 * 1. Finding an existing campaign and adset to work with
 * 2. Creating test ad copy variations
 * 3. Using existing creative (image hash) from a reference ad
 * 4. Creating 3 test ads in PAUSED status
 *
 * Run this on your LOCAL MACHINE (not in browser environment)
 */

require('dotenv').config();
const { FacebookAdsApi, AdAccount, Campaign, AdSet, Ad } = require('facebook-nodejs-business-sdk');

// Initialize Facebook API
FacebookAdsApi.init(process.env.META_ACCESS_TOKEN);
const account = new AdAccount(process.env.META_AD_ACCOUNT_ID);

async function testBulkAdCreation() {
    console.log('🚀 Testing Bulk Ad Creation System\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Get existing campaigns
        console.log('\n📋 Step 1: Finding existing campaigns...');
        const campaigns = await account.getCampaigns(
            ['id', 'name', 'status', 'objective'],
            { effective_status: ['ACTIVE', 'PAUSED'], limit: 10 }
        );

        if (campaigns.length === 0) {
            console.log('❌ No campaigns found. Please create a campaign first in Ads Manager.');
            return;
        }

        console.log(`✅ Found ${campaigns.length} campaign(s):`);
        campaigns.forEach((campaign, idx) => {
            console.log(`   ${idx + 1}. ${campaign.name} (${campaign.status}) - ${campaign.id}`);
        });

        // Use first campaign
        const campaign = campaigns[0];
        console.log(`\n🎯 Using campaign: ${campaign.name} (${campaign.id})`);

        // Step 2: Get adsets from campaign
        console.log('\n📋 Step 2: Finding adsets in campaign...');
        const campaignObj = new Campaign(campaign.id);
        const adsets = await campaignObj.getAdSets(
            ['id', 'name', 'status'],
            { effective_status: ['ACTIVE', 'PAUSED'], limit: 10 }
        );

        if (adsets.length === 0) {
            console.log('❌ No adsets found. Please create an adset first in Ads Manager.');
            return;
        }

        console.log(`✅ Found ${adsets.length} adset(s):`);
        adsets.forEach((adset, idx) => {
            console.log(`   ${idx + 1}. ${adset.name} (${adset.status}) - ${adset.id}`);
        });

        // Use first adset
        const adset = adsets[0];
        console.log(`\n🎯 Using adset: ${adset.name} (${adset.id})`);

        // Step 3: Get existing ads to find a reference ad with creative
        console.log('\n📋 Step 3: Finding reference ad with creative...');
        const adsetObj = new AdSet(adset.id);
        const existingAds = await adsetObj.getAds(
            ['id', 'name', 'status', 'creative'],
            { limit: 10 }
        );

        if (existingAds.length === 0) {
            console.log('❌ No existing ads found. Please create at least one ad first with an image.');
            console.log('   We need a reference ad to copy the creative from.');
            return;
        }

        console.log(`✅ Found ${existingAds.length} existing ad(s):`);
        existingAds.forEach((ad, idx) => {
            console.log(`   ${idx + 1}. ${ad.name} (${ad.status}) - ${ad.id}`);
        });

        // Use first ad as reference
        const referenceAd = existingAds[0];
        console.log(`\n🎯 Using reference ad: ${referenceAd.name} (${referenceAd.id})`);

        // Step 4: Get creative details from reference ad
        console.log('\n📋 Step 4: Getting creative details from reference ad...');
        const { AdCreative } = require('facebook-nodejs-business-sdk');
        const creative = new AdCreative(referenceAd.creative.id);
        const creativeDetails = await creative.read([
            'object_story_spec',
            'image_hash',
            'image_url'
        ]);

        const imageHash = creativeDetails.object_story_spec?.link_data?.image_hash;
        const pageId = creativeDetails.object_story_spec?.page_id || process.env.META_PAGE_ID;

        if (!imageHash) {
            console.log('❌ Could not find image hash in reference ad creative.');
            console.log('   Please make sure the reference ad has an image.');
            return;
        }

        console.log(`✅ Found image hash: ${imageHash}`);
        console.log(`✅ Using page ID: ${pageId}`);

        // Step 5: Create test ad copy variations
        console.log('\n📋 Step 5: Preparing test ad copy variations...');
        const testAdCopyVariations = [
            {
                bookId: 'test_book_001',
                variation: 'v1',
                primaryText: 'Discover an unforgettable romance that will keep you up all night reading!',
                headline: 'Fall in Love Today',
                description: 'Start reading now',
                landingPageUrl: `${process.env.BASE_LANDING_PAGE_URL || 'https://example.com'}?book_id=test_book_001&utm_source=facebook&utm_campaign=test`,
                callToAction: 'LEARN_MORE'
            },
            {
                bookId: 'test_book_001',
                variation: 'v2',
                primaryText: 'A steamy romance that readers can\'t put down. Over 1000 5-star reviews!',
                headline: 'Readers Love This Book',
                description: 'Get your copy today',
                landingPageUrl: `${process.env.BASE_LANDING_PAGE_URL || 'https://example.com'}?book_id=test_book_001&utm_source=facebook&utm_campaign=test`,
                callToAction: 'LEARN_MORE'
            },
            {
                bookId: 'test_book_001',
                variation: 'v3',
                primaryText: 'Experience passion and drama in this bestselling romance novel.',
                headline: 'Bestselling Romance',
                description: 'Download now',
                landingPageUrl: `${process.env.BASE_LANDING_PAGE_URL || 'https://example.com'}?book_id=test_book_001&utm_source=facebook&utm_campaign=test`,
                callToAction: 'LEARN_MORE'
            }
        ];

        console.log(`✅ Created ${testAdCopyVariations.length} ad copy variations`);

        // Step 6: Create test ads (PAUSED status for safety)
        console.log('\n📋 Step 6: Creating test ads in PAUSED status...');
        console.log('   (You can review and activate them manually in Ads Manager)\n');

        const results = [];
        for (let i = 0; i < testAdCopyVariations.length; i++) {
            const adCopy = testAdCopyVariations[i];

            try {
                const adName = `TEST_${adCopy.bookId}_${adCopy.variation}_${Date.now()}`;
                console.log(`   Creating ${i + 1}/${testAdCopyVariations.length}: ${adName}...`);

                const adData = {
                    name: adName,
                    adset_id: adset.id,
                    creative: {
                        object_story_spec: {
                            page_id: pageId,
                            link_data: {
                                link: adCopy.landingPageUrl,
                                message: adCopy.primaryText,
                                name: adCopy.headline,
                                description: adCopy.description,
                                call_to_action: {
                                    type: adCopy.callToAction
                                },
                                image_hash: imageHash
                            }
                        }
                    },
                    status: 'PAUSED'
                };

                const newAd = await account.createAd([], adData);

                results.push({
                    success: true,
                    adName,
                    adId: newAd.id,
                    variation: adCopy.variation
                });

                console.log(`   ✅ Created: ${newAd.id}`);

                // Rate limiting - wait 1 second between ad creations
                if (i < testAdCopyVariations.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                results.push({
                    success: false,
                    adName: `TEST_${adCopy.bookId}_${adCopy.variation}`,
                    variation: adCopy.variation,
                    error: error.message
                });

                console.log(`   ❌ Failed: ${error.message}`);
            }
        }

        // Step 7: Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 BULK AD CREATION TEST SUMMARY');
        console.log('='.repeat(60) + '\n');

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`✅ Successful: ${successful}/${testAdCopyVariations.length}`);
        console.log(`❌ Failed: ${failed}/${testAdCopyVariations.length}\n`);

        if (successful > 0) {
            console.log('Successfully created ads:');
            results.filter(r => r.success).forEach((result, idx) => {
                console.log(`   ${idx + 1}. ${result.adName}`);
                console.log(`      ID: ${result.adId}`);
                console.log(`      Variation: ${result.variation}\n`);
            });
        }

        if (failed > 0) {
            console.log('Failed ads:');
            results.filter(r => !r.success).forEach((result, idx) => {
                console.log(`   ${idx + 1}. ${result.adName}`);
                console.log(`      Error: ${result.error}\n`);
            });
        }

        console.log('='.repeat(60));
        console.log('🎉 BULK AD CREATION TEST COMPLETED!');
        console.log('='.repeat(60));
        console.log('\n💡 Next steps:');
        console.log('   1. Check the ads in Meta Ads Manager');
        console.log('   2. All test ads are in PAUSED status');
        console.log('   3. Review and activate them manually if desired');
        console.log('   4. You can delete test ads if you don\'t need them\n');

    } catch (error) {
        console.error('\n❌ Test Failed!');
        console.error('Error:', error.message);
        console.error('\nFull error:', error);
    }
}

// Run the test
console.log('\n⚠️  IMPORTANT: Run this script on your LOCAL MACHINE');
console.log('   (The browser environment has network restrictions)\n');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
    testBulkAdCreation();
}, 3000);
