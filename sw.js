// No.1 Delivery — Service Worker
// Handles background push notifications

const CACHE_NAME = 'no1-delivery-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  let data = { title: 'No.1 Delivery', body: 'You have a new notification.' };
  try {
    data = e.data.json();
  } catch(err) {
    data.body = e.data?.text() || data.body;
  }

  e.waitUntil(
    self.registration.showNotification(data.title || 'No.1 Delivery', {
      body:    data.body || '',
      icon:    '/no1-delivery/icon-192.png',
      badge:   '/no1-delivery/icon-192.png',
      tag:     data.tag || 'no1-delivery',
      data:    data.url || '/no1-delivery/notifications.html',
      vibrate: [200, 100, 200],
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data || '/no1-delivery/notifications.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('no1-delivery') && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
