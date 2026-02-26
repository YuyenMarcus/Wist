'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

// ⚠️ CONFIRM THIS ID MATCHES YOUR CHROME://EXTENSIONS
const EXTENSION_ID = "hlgalligngcfiaibgkinhlkaniibjlmh";

/**
 * NotificationForwarder Component
 * 
 * Checks for pending price drop notifications and forwards them to the Chrome extension.
 * This runs client-side on the website and sends messages to the extension.
 */
export default function NotificationForwarder() {

  useEffect(() => {
    // Only run if extension ID is configured
    if (!EXTENSION_ID) {
      console.log('⚠️ [NotificationForwarder] Extension ID not configured');
      return;
    }

    // Check for notifications every 30 seconds
    const checkInterval = setInterval(async () => {
      await checkAndForwardNotifications();
    }, 30000); // 30 seconds

    // Also check immediately on mount
    checkAndForwardNotifications();

    return () => clearInterval(checkInterval);
  }, []);

  async function checkAndForwardNotifications() {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return; // User not logged in
      }

      const user = session.user;

      // Check if Chrome extension API is available
      if (typeof window === 'undefined' || !(window as any).chrome || !(window as any).chrome.runtime) {
        return; // Extension API not available
      }

      // Get pending notifications for this user
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select(`
          id,
          item_id,
          notification_type,
          old_price,
          new_price,
          price_change_percent,
          items (
            title,
            image_url,
            url
          )
        `)
        .eq('user_id', user.id)
        .eq('sent', false)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('❌ [NotificationForwarder] Error fetching notifications:', error);
        return;
      }

      if (!notifications || notifications.length === 0) {
        return; // No pending notifications
      }

      console.log(`🔔 [NotificationForwarder] Found ${notifications.length} pending notification(s)`);

      // Format notifications for extension
      const formattedNotifications = notifications.map(n => {
        const item = Array.isArray(n.items) ? n.items[0] : n.items;
        return {
          itemId: n.item_id,
          type: (n as any).notification_type || 'price_drop',
          itemTitle: item?.title || 'Unknown Item',
          itemImage: item?.image_url,
          itemUrl: item?.url,
          oldPrice: n.old_price,
          newPrice: n.new_price,
          priceChange: n.price_change_percent,
        };
      });

      // Send to extension
      const chrome = (window as any).chrome;
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: 'PRICE_DROP_NOTIFICATION',
          notifications: formattedNotifications,
        },
        (response: any) => {
          if (chrome.runtime.lastError) {
            console.log('⚠️ [NotificationForwarder] Extension not responding:', chrome.runtime.lastError.message);
          } else {
            console.log('✅ [NotificationForwarder] Notifications sent to extension');
            
            // Mark notifications as sent
            markNotificationsAsSent(notifications.map(n => n.id));
          }
        }
      );
    } catch (error) {
      console.error('❌ [NotificationForwarder] Error:', error);
    }
  }

  async function markNotificationsAsSent(notificationIds: string[]) {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
        })
        .in('id', notificationIds);

      if (error) {
        console.error('❌ [NotificationForwarder] Error marking notifications as sent:', error);
      } else {
        console.log(`✅ [NotificationForwarder] Marked ${notificationIds.length} notification(s) as sent`);
      }
    } catch (error) {
      console.error('❌ [NotificationForwarder] Error marking notifications:', error);
    }
  }

  // This component doesn't render anything
  return null;
}
