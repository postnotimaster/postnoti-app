const admin = require('firebase-admin');

// 환경 변수에서 서비스 계정 정보를 가져오거나, 로컬이라면 환경변수를 직접 체크합니다.
// Vercel 설정에서 FIREBASE_ADMIN_SDK_JSON 이라는 이름으로 전체 JSON 내용을 넣으시면 됩니다.
let initError = null;
if (!admin.apps.length) {
    try {
        if (!process.env.FIREBASE_ADMIN_SDK_JSON) {
            throw new Error('FIREBASE_ADMIN_SDK_JSON environment variable is missing.');
        }
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Firebase admin initialization failed:', error);
        initError = error;
    }
}

module.exports = async (req, res) => {
    if (initError) {
        return res.status(500).json({ error: 'Firebase Admin failed to initialize', details: initError.message });
    }

    // POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const message = {
            token: token,
            notification: {
                title: title,
                body: body
            },
            data: {
                title: title,
                body: body,
                ...data
            },
            android: {
                priority: 'high',
            },
            apns: {
                payload: {
                    aps: {
                        contentAvailable: true // Required for background data connection
                    }
                }
            },
            webpush: {
                headers: {
                    Urgency: "high"
                },
                fcm_options: {
                    link: data.url || '/' // 알림 클릭 시 자동으로 열릴 앱 URL 지정
                }
            }
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending push notification:', error);
        return res.status(500).json({ error: 'Failed to send notification', details: error.message });
    }
};
