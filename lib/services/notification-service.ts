/**
 * Notification Service - Handles tiered price drop notifications
 * 
 * Features:
 * - Free tier: Weekly digest
 * - Pro tier: Daily digest
 * - Creator tier: Instant notifications
 */

import { createClient } from '@/lib/supabase/server';
import { canSendNotification, SubscriptionTier } from '@/lib/constants/subscription-tiers';

export interface PriceDropNotification {
  userId: string;
  itemId: string;
  itemTitle: string;
  oldPrice: number;
  newPrice: number;
  priceChangePercent: number;
}

export class NotificationService {
  /**
   * Queue a price drop notification
   */
  static async queuePriceDropNotification(data: PriceDropNotification) {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('notification_queue')
      .insert({
        user_id: data.userId,
        item_id: data.itemId,
        notification_type: 'price_drop',
        old_price: data.oldPrice,
        new_price: data.newPrice,
        price_change_percent: data.priceChangePercent,
      });
    
    if (error) {
      console.error('Failed to queue notification:', error);
      return false;
    }
    
    return true;
  }
  
  /**
   * Process pending notifications based on user tier
   */
  static async processPendingNotifications() {
    const supabase = await createClient();
    
    // Get all unsent notifications
    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select(`
        id,
        user_id,
        item_id,
        notification_type,
        old_price,
        new_price,
        price_change_percent,
        created_at,
        items (
          title,
          image,
          url
        )
      `)
      .eq('sent', false)
      .order('created_at', { ascending: true });
    
    if (error || !notifications) {
      console.error('Failed to fetch notifications:', error);
      return;
    }
    
    // Group notifications by user
    const notificationsByUser = notifications.reduce((acc, notif) => {
      if (!acc[notif.user_id]) {
        acc[notif.user_id] = [];
      }
      acc[notif.user_id].push(notif);
      return acc;
    }, {} as Record<string, typeof notifications>);
    
    // Process each user's notifications
    for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
      await this.sendNotificationsForUser(userId, userNotifications);
    }
  }
  
  /**
   * Send notifications for a specific user based on their tier
   */
  private static async sendNotificationsForUser(
    userId: string,
    notifications: any[]
  ) {
    const supabase = await createClient();
    
    // Get user's subscription tier and last notification time
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, last_notification_sent')
      .eq('id', userId)
      .single();
    
    if (!profile) {
      console.error('User profile not found:', userId);
      return;
    }
    
    const tier = profile.subscription_tier as SubscriptionTier;
    const lastSent = profile.last_notification_sent 
      ? new Date(profile.last_notification_sent) 
      : null;
    
    // Check if user can receive notification based on tier
    if (!canSendNotification(tier, lastSent)) {
      console.log(`User ${userId} (${tier}) not ready for notification yet`);
      return;
    }
    
    // Send notification based on tier
    if (tier === 'creator') {
      // Send individual notifications instantly
      for (const notification of notifications) {
        await this.sendBrowserNotification(userId, [notification]);
        await this.markNotificationSent(notification.id);
      }
    } else {
      // Bundle notifications for free/pro users
      await this.sendBrowserNotification(userId, notifications);
      await this.markNotificationsSent(notifications.map(n => n.id));
    }
    
    // Update last notification sent time
    await supabase
      .from('profiles')
      .update({ last_notification_sent: new Date().toISOString() })
      .eq('id', userId);
  }
  
  /**
   * Send browser notification
   */
  private static async sendBrowserNotification(
    userId: string,
    notifications: any[]
  ) {
    // This will be handled by the extension's background script
    // Send message to extension via Chrome runtime API
    
    const message = {
      type: 'PRICE_DROP_NOTIFICATION',
      notifications: notifications.map(n => ({
        itemId: n.item_id,
        itemTitle: n.items?.title || 'Unknown Item',
        itemImage: n.items?.image,
        itemUrl: n.items?.url,
        oldPrice: n.old_price,
        newPrice: n.new_price,
        priceChange: n.price_change_percent,
      })),
    };
    
    // Log for now (will be replaced with actual browser notification)
    console.log('Browser notification:', message);
    
    // TODO: Implement actual browser notification via Chrome extension API
    // This requires the extension to have a background service worker
    // that listens for these messages
  }
  
  /**
   * Mark a notification as sent
   */
  private static async markNotificationSent(notificationId: string) {
    const supabase = await createClient();
    
    await supabase
      .from('notification_queue')
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notificationId);
  }
  
  /**
   * Mark multiple notifications as sent
   */
  private static async markNotificationsSent(notificationIds: string[]) {
    const supabase = await createClient();
    
    await supabase
      .from('notification_queue')
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
      })
      .in('id', notificationIds);
  }
}
