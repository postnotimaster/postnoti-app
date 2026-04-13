importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyA0BIVn1MBBw3jJmiMbEkvAl9iLegYDQPI",
    authDomain: "postnoti-3e88f.firebaseapp.com",
    projectId: "postnoti-3e88f",
    storageBucket: "postnoti-3e88f.firebasestorage.app",
    messagingSenderId: "78669500813",
    appId: "1:78669500813:web:febd016375e3d46b55edc4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Data-only message handling
    const data = payload.data || {};
    const notificationTitle = data.title || '알림';
    const notificationOptions = {
        body: data.body || '내용 없음',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: data // Keep original data including url
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Get URL from data
    const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            // Check if there is already a window open with this URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
