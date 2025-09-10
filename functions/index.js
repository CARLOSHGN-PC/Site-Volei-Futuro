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

    const payload = {
        "reference_id": orderReferenceId,
        "customer": {
            "name": context.auth.token.name || 'Anonymous User',
            "email": context.auth.token.email,
            // In a real application, you would collect this from the user.
            // "tax_id": "12345678900"
        },
        "items": items,
        // The shipping address is hardcoded for this example.
        // In a real application, you would collect this from the user.
        "shipping": {
            "address": {
              "street": "Avenida Brigadeiro Faria Lima",
              "number": "1384",
              "complement": "apto 132",
              "locality": "Jardim Paulistano",
              "city": "Sao Paulo",
              "region_code": "SP",
              "country": "BRA",
              "postal_code": "01451001"
            }
        },
        "notification_urls": [],
        "charges": [
            {
                "reference_id": orderReferenceId, // Each charge must have a unique reference_id
                "description": "Venda de produtos Vôlei Futuro",
                "amount": {
                    "value": data.items.reduce((total, item) => total + (Math.round(item.price * 100) * item.quantity), 0),
                    "currency": "BRL"
                },
                "payment_method": {
                    "type": "BOLETO", // Changed to Boleto for simplicity, as it requires less user data
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

        return { checkoutUrl: checkoutLink.href };

    } catch (error) {
        console.error("Error creating PagSeguro checkout:", error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Could not create a PagSeguro checkout session.', error.message);
    }
});
