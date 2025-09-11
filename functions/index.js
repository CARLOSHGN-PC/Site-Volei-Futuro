const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// Define secrets. NOTE: User's plan may not support this UI, but it's best practice.
// They will need to set these via CLI or other means if the UI is unavailable.
const PAGSEGURO_TOKEN = functions.params.defineSecret('PAGSEGURO_TOKEN');
const FRENET_TOKEN = functions.params.defineSecret('FRENET_TOKEN');
const EMAIL_ENDPOINT_SECRET = functions.params.defineSecret('EMAIL_ENDPOINT_SECRET');

// The URL of the server that can send emails (must have SENDGRID_API_KEY set)
const EMAIL_SENDER_URL = 'https://volei-futuro.onrender.com/send-email';

const ptOrderStatus = {
    PENDING: 'Pendente',
    PAYMENT_APPROVED: 'Pagamento Aprovado',
    PROCESSING: 'Em Separação',
    SHIPPED: 'Enviado',
    IN_TRANSIT: 'Em Trânsito',
    OUT_FOR_DELIVERY: 'Saiu para Entrega',
    DELIVERED: 'Entregue',
    CANCELED: 'Cancelado'
};

async function sendStatusUpdateEmail(orderId, userId, newStatus) {
    if (!userId || !newStatus) return;

    try {
        const user = await admin.auth().getUser(userId);
        if (!user.email) return;

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #dc2626;">Atualização do seu Pedido!</h2>
                <p>Olá ${user.displayName || ''},</p>
                <p>O status do seu pedido <strong>${orderId}</strong> foi atualizado para: <strong>${ptOrderStatus[newStatus] || newStatus}</strong>.</p>
                <p>Você pode ver todos os detalhes acessando a sua conta em nosso site.</p>
                <p>Atenciosamente,<br>Equipe Vôlei Futuro</p>
            </div>
        `;

        const payload = {
            to: user.email,
            from: 'contato@voleifuturo.com',
            subject: `Seu pedido foi atualizado: ${ptOrderStatus[newStatus] || newStatus}`,
            html: emailHtml,
            secret: EMAIL_ENDPOINT_SECRET.value()
        };

        await axios.post(EMAIL_SENDER_URL, payload);
        console.log(`Status update email sent to ${user.email} for order ${orderId}`);
    } catch (error) {
        console.error(`Failed to send status update email for order ${orderId}:`, error.response ? error.response.data : error.message);
    }
}


exports.createPagSeguroCheckout = functions.runWith({ secrets: ["PAGSEGURO_TOKEN"] }).https.onCall(async (data, context) => {
    // 1. Check if the user is authenticated.
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    // 2. Validate the incoming data (cart items)
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with an "items" array.');
    }

    const items = data.items.map(item => ({
        "name": item.name,
        "quantity": item.quantity,
        "unit_amount": Math.round(item.price * 100) // Price in cents
    }));

    // The PagSeguro API requires a reference_id for the order.
    const orderReferenceId = `ref_${context.auth.uid}_${new Date().getTime()}`;

    const subtotal = data.items.reduce((total, item) => total + (Math.round(item.price * 100) * item.quantity), 0);
    const shippingCost = data.shipping ? Math.round(data.shipping.cost * 100) : 0;
    const totalAmount = subtotal + shippingCost;

    if (!data.customer || !data.customer.cpf || !data.customer.address) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with customer CPF and address.');
    }

    const payload = {
        "reference_id": orderReferenceId,
        "customer": {
            "name": context.auth.token.name || 'Anonymous User',
            "email": context.auth.token.email,
            "tax_id": data.customer.cpf.replace(/\D/g, ''),
        },
        "items": items,
        "shipping": {
            "amount": shippingCost,
            "address": {
                "street": data.customer.address.street,
                "number": data.customer.address.number,
                "complement": data.customer.address.complement,
                "locality": data.customer.address.neighborhood,
                "city": data.customer.address.city,
                "region_code": data.customer.address.state,
                "country": "BRA",
                "postal_code": data.customer.address.zipcode.replace(/\D/g, ''),
            }
        },
        "notification_urls": [],
        "charges": [
            {
                "reference_id": orderReferenceId,
                "description": "Venda de produtos Vôlei Futuro",
                "amount": {
                    "value": totalAmount,
                    "currency": "BRL"
                },
                "payment_method": {
                    "type": "BOLETO",
                    "capture": true
                }
            }
        ]
    };

    try {
        const response = await axios.post(
            'https://api.pagseguro.com/orders',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${PAGSEGURO_TOKEN.value()}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const checkoutLink = response.data.links.find(link => link.rel === 'PAY');
        if (!checkoutLink) {
            throw new Error('Checkout link not found in PagSeguro response');
        }

        // Save the order to Firestore
        const orderPayload = {
            userId: context.auth.uid,
            pagseguroOrderId: response.data.id,
            referenceId: orderReferenceId,
            createdAt: new Date(),
            items: items,
            shipping: data.shipping,
            totalAmount: totalAmount,
            status: 'PENDING'
        };
        await admin.firestore().collection('orders').add(orderPayload);

        return { checkoutUrl: checkoutLink.href };

    } catch (error) {
        console.error("Error creating PagSeguro checkout:", error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Could not create a PagSeguro checkout session.', error.message);
    }
});

exports.updateTrackingStatus = functions.runWith({ secrets: ["FRENET_TOKEN", "EMAIL_ENDPOINT_SECRET"] }).pubsub.schedule('every 4 hours').onRun(async (context) => {
    const frenetToAppStatusMap = {
        'ENTREGUE': 'DELIVERED',
        'AGUARDANDO_RETIRADA': 'IN_TRANSIT',
        'EM_TRANSITO': 'IN_TRANSIT',
        'SAIU_PARA_ENTREGA': 'OUT_FOR_DELIVERY',
        'DEVOLVIDO_AO_REMETENTE': 'CANCELED',
        'POSTADO': 'SHIPPED',
    };

    const ordersRef = admin.firestore().collection('orders');
    const statusesToTrack = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
    const snapshot = await ordersRef.where('status', 'in', statusesToTrack).get();

    if (snapshot.empty) {
        console.log('No orders to track.');
        return null;
    }

    const promises = snapshot.docs.map(async (doc) => {
        const order = doc.data();
        const orderId = doc.id;

        if (!order.trackingCode) return;

        try {
            const response = await axios.post('https://api.frenet.com.br/shipping/trackinginfo', {
                ShippingServiceCode: null,
                TrackingNumber: order.trackingCode,
            }, {
                headers: { 'Content-Type': 'application/json', 'token': FRENET_TOKEN.value() }
            });

            const trackingEvents = response.data.TrackingEvents;
            if (trackingEvents && trackingEvents.length > 0) {
                const latestEvent = trackingEvents[trackingEvents.length - 1];
                const frenetStatus = latestEvent.EventTypeCode;
                const newAppStatus = frenetToAppStatusMap[frenetStatus];

                if (newAppStatus && newAppStatus !== order.status) {
                    console.log(`Updating order ${orderId} from ${order.status} to ${newAppStatus}`);
                    await doc.ref.update({ status: newAppStatus });
                    await sendStatusUpdateEmail(orderId, order.userId, newAppStatus);
                }
            }
        } catch (error) {
            console.error(`Failed to track order ${orderId}:`, error.response ? error.response.data : error.message);
        }
    });

    await Promise.all(promises);
    return null;
});

exports.updateOrderStatus = functions.runWith({ secrets: ["EMAIL_ENDPOINT_SECRET"] }).https.onCall(async (data, context) => {
    // A simple auth check. For a real app, you'd want to check for admin custom claims.
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { orderId, newStatus, trackingCode } = data;
    if (!orderId || !newStatus) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with an "orderId" and "newStatus".');
    }

    try {
        const orderRef = admin.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found.');
        }
        const orderData = orderDoc.data();

        const updatePayload = { status: newStatus };
        if (trackingCode !== undefined) {
            updatePayload.trackingCode = trackingCode;
        }

        await orderRef.update(updatePayload);

        // Send email only if the status has actually changed
        if (orderData.status !== newStatus) {
            await sendStatusUpdateEmail(orderId, orderData.userId, newStatus);
        }

        return { success: true, message: 'Order updated successfully.' };

    } catch (error) {
        console.error('Error updating order status:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update order status.', error.message);
    }
});
