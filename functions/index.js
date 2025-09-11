const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// Define the PagSeguro token secret using the new method
const PAGSEGURO_TOKEN = functions.params.defineSecret('PAGSEGURO_TOKEN');

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

exports.updateTrackingStatus = functions.pubsub.schedule('every 4 hours').onRun(async (context) => {
    const frenetToAppStatusMap = {
        'ENTREGUE': 'DELIVERED',
        'AGUARDANDO_RETIRADA': 'IN_TRANSIT', // Or a new custom status
        'EM_TRANSITO': 'IN_TRANSIT',
        'SAIU_PARA_ENTREGA': 'OUT_FOR_DELIVERY',
        'DEVOLVIDO_AO_REMETENTE': 'CANCELED', // Or a new 'RETURNED' status
        'POSTADO': 'SHIPPED',
    };

    const ordersRef = admin.firestore().collection('orders');
    const statusesToTrack = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
    const snapshot = await ordersRef.where('status', 'in', statusesToTrack).get();

    if (snapshot.empty) {
        console.log('No orders to track.');
        return null;
    }

    const promises = [];
    snapshot.forEach(doc => {
        const order = doc.data();
        if (order.trackingCode) {
            const trackingPromise = axios.post('https://api.frenet.com.br/shipping/trackinginfo', {
                ShippingServiceCode: null,
                TrackingNumber: order.trackingCode,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': '4692D145RD022R4DCARA04ER34EA62422852'
                }
            }).then(response => {
                const trackingEvents = response.data.TrackingEvents;
                if (trackingEvents && trackingEvents.length > 0) {
                    const latestEvent = trackingEvents[trackingEvents.length - 1];
                    const frenetStatus = latestEvent.EventTypeCode; // Assuming this is the status code
                    const newAppStatus = frenetToAppStatusMap[frenetStatus];

                    if (newAppStatus && newAppStatus !== order.status) {
                        console.log(`Updating order ${doc.id} from ${order.status} to ${newAppStatus}`);
                        return doc.ref.update({ status: newAppStatus });
                    }
                }
            }).catch(error => {
                console.error(`Failed to track order ${doc.id}:`, error.response ? error.response.data : error.message);
            });
            promises.push(trackingPromise);
        }
    });

    await Promise.all(promises);
    return null;
});
