const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey && supabaseUrl !== 'your_supabase_url') {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialized');
} else {
  console.log('⚠️  Supabase not configured - performance monitoring features will be limited');
}

class SupabaseService {
  // Get KPI metrics by ad ID (streak activation, purchase, revenue, ROAS)
  async getKPIMetricsByAdId(adId, timeframe = '7d') {
    if (!supabase) {
      console.warn('Supabase not configured - returning mock KPI data');
      return this.getMockKPIMetrics();
    }
    
    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select(`
          ad_id,
          user_id,
          install_date,
          attribution_data,
          
          -- Streak metrics
          streak_activated,
          streak_activation_date,
          first_streak_length,
          
          -- Revenue metrics  
          first_purchase_made,
          first_purchase_date,
          first_purchase_amount,
          total_revenue,
          lifetime_value,
          
          -- Engagement metrics
          total_sessions,
          total_time_spent,
          day_1_active,
          day_3_active,
          day_7_active,
          last_active_date
        `)
        .eq('ad_id', adId)
        .gte('install_date', this.getTimeframeDate(timeframe));

      if (error) throw error;

      return this.calculateKPIMetrics(data);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      throw error;
    }
  }

  // Get user retention data by ad ID (legacy method for backward compatibility)
  async getUserRetentionByAdId(adId, timeframe = '24h') {
    const kpiData = await this.getKPIMetricsByAdId(adId, timeframe);
    return {
      totalUsers: kpiData.totalUsers,
      day1Retention: kpiData.day1ActiveRate,
      day3Retention: kpiData.day3ActiveRate,
      day7Retention: kpiData.day7ActiveRate,
      avgSessionCount: kpiData.avgSessionCount,
      avgTimeSpent: kpiData.avgTimeSpent,
      totalRevenue: kpiData.totalRevenue
    };
  }

  // Get ad performance metrics from mobile app data
  async getAdPerformanceMetrics(adIds) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty performance metrics');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select(`
          ad_id,
          user_id,
          install_date,
          day_1_retention,
          day_3_retention,
          day_7_retention,
          session_count,
          total_time_spent,
          revenue_generated,
          ltv_prediction
        `)
        .in('ad_id', adIds)
        .gte('install_date', this.getTimeframeDate('7d'));

      if (error) throw error;

      return this.aggregateAdPerformance(data);
    } catch (error) {
      console.error('Error fetching ad performance metrics:', error);
      throw error;
    }
  }

  // Get underperforming ads based on KPI thresholds  
  async getUnderperformingAds(thresholds = {}) {
    if (!supabase) {
      console.warn('Supabase not configured - returning empty underperforming ads list');
      return [];
    }
    
    const defaultThresholds = {
      // Key KPI thresholds
      maxCostPerStreakActivation: 10.0, // $10 max cost per streak activation
      maxCostPerPurchase: 25.0, // $25 max cost per purchase  
      minROAS: 1.5, // 1.5x minimum return on ad spend
      
      // Legacy retention thresholds (still useful)
      minDay1Retention: 0.3, // 30%
      minDay3Retention: 0.15, // 15%
      minDay7Retention: 0.08, // 8%
      minSessionCount: 2,
      minTimeSpent: 300, // 5 minutes
      minInstalls: 10,
      ...thresholds
    };

    try {
      // Get aggregated data for each ad
      const { data, error } = await supabase
        .from('ad_performance_summary')
        .select('*')
        .gte('install_date', this.getTimeframeDate('7d'));

      if (error) throw error;

      // Filter underperforming ads
      const underperforming = data.filter(ad => {
        return (
          ad.day_1_retention_rate < defaultThresholds.minDay1Retention ||
          ad.day_3_retention_rate < defaultThresholds.minDay3Retention ||
          ad.day_7_retention_rate < defaultThresholds.minDay7Retention ||
          ad.avg_session_count < defaultThresholds.minSessionCount ||
          ad.avg_time_spent < defaultThresholds.minTimeSpent ||
          ad.total_installs < defaultThresholds.minInstalls
        );
      });

      return underperforming.map(ad => ({
        adId: ad.ad_id,
        campaignId: ad.campaign_id,
        adSetId: ad.adset_id,
        totalInstalls: ad.total_installs,
        day1Retention: ad.day_1_retention_rate,
        day3Retention: ad.day_3_retention_rate,
        day7Retention: ad.day_7_retention_rate,
        avgSessionCount: ad.avg_session_count,
        avgTimeSpent: ad.avg_time_spent,
        revenue: ad.total_revenue,
        ltv: ad.avg_ltv,
        reasonsForPause: this.getReasonForPause(ad, defaultThresholds)
      }));

    } catch (error) {
      console.error('Error getting underperforming ads:', error);
      throw error;
    }
  }

  // Get user journey data for attribution
  async getUserJourneyData(userId) {
    try {
      const { data, error } = await supabase
        .from('user_journey')
        .select(`
          user_id,
          ad_id,
          campaign_id,
          landing_page_url,
          install_date,
          first_session_date,
          attribution_data,
          conversion_events
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user journey data:', error);
      throw error;
    }
  }

  // Update ad performance summary (called by cron job)
  async updateAdPerformanceSummary() {
    try {
      // This would typically be a stored procedure or complex query
      const { data, error } = await supabase.rpc('update_ad_performance_summary');
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating ad performance summary:', error);
      throw error;
    }
  }

  // Store ad pause action
  async logAdPauseAction(adId, reason, metrics) {
    try {
      const { data, error } = await supabase
        .from('ad_pause_log')
        .insert({
          ad_id: adId,
          pause_reason: reason,
          pause_date: new Date().toISOString(),
          metrics_at_pause: metrics,
          automated: true
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error logging ad pause action:', error);
      throw error;
    }
  }

  // Get real-time metrics for dashboard
  async getRealTimeMetrics(timeframe = '1h') {
    try {
      const { data, error } = await supabase
        .from('real_time_metrics')
        .select('*')
        .gte('timestamp', this.getTimeframeDate(timeframe))
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      throw error;
    }
  }

  // Helper methods
  getTimeframeDate(timeframe) {
    const now = new Date();
    const units = {
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000
    };

    const match = timeframe.match(/^(\d+)([hdw])$/);
    if (!match) return now.toISOString();

    const [, amount, unit] = match;
    const milliseconds = parseInt(amount) * units[unit];
    return new Date(now.getTime() - milliseconds).toISOString();
  }

  // Calculate comprehensive KPI metrics
  calculateKPIMetrics(userData) {
    if (!userData || userData.length === 0) {
      return {
        totalUsers: 0,
        streakActivations: 0,
        streakActivationRate: 0,
        purchases: 0,
        purchaseRate: 0,
        totalRevenue: 0,
        avgRevenuePerUser: 0,
        avgRevenuePerPurchase: 0,
        day1ActiveRate: 0,
        day3ActiveRate: 0,
        day7ActiveRate: 0,
        avgSessionCount: 0,
        avgTimeSpent: 0
      };
    }

    const totalUsers = userData.length;
    const streakActivated = userData.filter(u => u.streak_activated).length;
    const purchaseMade = userData.filter(u => u.first_purchase_made).length;
    const day1Active = userData.filter(u => u.day_1_active).length;
    const day3Active = userData.filter(u => u.day_3_active).length;
    const day7Active = userData.filter(u => u.day_7_active).length;
    
    const totalRevenue = userData.reduce((sum, u) => sum + (u.total_revenue || 0), 0);
    const totalSessions = userData.reduce((sum, u) => sum + (u.total_sessions || 0), 0);
    const totalTimeSpent = userData.reduce((sum, u) => sum + (u.total_time_spent || 0), 0);

    return {
      totalUsers,
      streakActivations: streakActivated,
      streakActivationRate: streakActivated / totalUsers,
      purchases: purchaseMade,
      purchaseRate: purchaseMade / totalUsers,
      totalRevenue,
      avgRevenuePerUser: totalRevenue / totalUsers,
      avgRevenuePerPurchase: purchaseMade > 0 ? totalRevenue / purchaseMade : 0,
      day1ActiveRate: day1Active / totalUsers,
      day3ActiveRate: day3Active / totalUsers,
      day7ActiveRate: day7Active / totalUsers,
      avgSessionCount: totalSessions / totalUsers,
      avgTimeSpent: totalTimeSpent / totalUsers
    };
  }

  // Legacy method for backward compatibility
  calculateRetentionMetrics(userData) {
    const kpiMetrics = this.calculateKPIMetrics(userData);
    return {
      totalUsers: kpiMetrics.totalUsers,
      day1Retention: kpiMetrics.day1ActiveRate,
      day3Retention: kpiMetrics.day3ActiveRate,
      day7Retention: kpiMetrics.day7ActiveRate,
      avgSessionCount: kpiMetrics.avgSessionCount,
      avgTimeSpent: kpiMetrics.avgTimeSpent,
      totalRevenue: kpiMetrics.totalRevenue
    };
  }

  aggregateAdPerformance(userData) {
    const adGroups = {};
    
    userData.forEach(user => {
      if (!adGroups[user.ad_id]) {
        adGroups[user.ad_id] = [];
      }
      adGroups[user.ad_id].push(user);
    });

    return Object.keys(adGroups).map(adId => ({
      adId,
      ...this.calculateRetentionMetrics(adGroups[adId])
    }));
  }

  getReasonForPause(ad, thresholds) {
    const reasons = [];
    
    if (ad.day_1_retention_rate < thresholds.minDay1Retention) {
      reasons.push(`Low D1 retention: ${(ad.day_1_retention_rate * 100).toFixed(1)}% < ${(thresholds.minDay1Retention * 100).toFixed(1)}%`);
    }
    
    if (ad.day_3_retention_rate < thresholds.minDay3Retention) {
      reasons.push(`Low D3 retention: ${(ad.day_3_retention_rate * 100).toFixed(1)}% < ${(thresholds.minDay3Retention * 100).toFixed(1)}%`);
    }
    
    if (ad.avg_session_count < thresholds.minSessionCount) {
      reasons.push(`Low session count: ${ad.avg_session_count.toFixed(1)} < ${thresholds.minSessionCount}`);
    }
    
    if (ad.avg_time_spent < thresholds.minTimeSpent) {
      reasons.push(`Low time spent: ${Math.round(ad.avg_time_spent)}s < ${thresholds.minTimeSpent}s`);
    }
    
    return reasons;
  }

  // Mock data for when Supabase is not configured
  getMockKPIMetrics() {
    return {
      totalUsers: 0,
      streakActivations: 0,
      streakActivationRate: 0,
      purchases: 0,
      purchaseRate: 0,
      totalRevenue: 0,
      avgRevenuePerUser: 0,
      avgRevenuePerPurchase: 0,
      day1ActiveRate: 0,
      day3ActiveRate: 0,
      day7ActiveRate: 0,
      avgSessionCount: 0,
      avgTimeSpent: 0
    };
  }
}

module.exports = new SupabaseService();