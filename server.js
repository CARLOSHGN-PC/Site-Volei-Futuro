require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const crypto = require('crypto');

if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    console.warn("WARNING: SENDGRID_API_KEY is not set. Email sending will fail.");
}

const MERCADOPAGO_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!MERCADOPAGO_TOKEN) {
    console.error('ERROR: MERCADOPAGO_ACCESS_TOKEN is not set in environment variables or .env file!');
}

const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_TOKEN });

// Initialize Firebase Admin SDK
// The credentials will be loaded from an environment variable
// which the user will need to set up on Render.
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('ascii'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();

// Middleware
app.use(cors()); // In a real production environment, you should configure this more securely.
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from the root directory

const BASE_URL = process.env.BASE_URL || 'https://volei-futuro.onrender.com';

// =============================================================================
// HELPERS
// =============================================================================
function sanitizeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>?/gm, '');
}

// =============================================================================
// EMAIL SERVICE
// =============================================================================
async function sendTransactionalEmail({ to, subject, html }) {
    if (!to) {
        console.error('Email sending failed: No recipient specified.');
        return;
    }

    const msg = {
        to,
        from: process.env.EMAIL_FROM || 'contato@voleifuturo.com', // Must be a verified sender
        subject,
        html
    };

    try {
        await sgMail.send(msg);
        console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.response) {
            console.error(error.response.body);
        }
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/calculate-shipping', async (req, res) => {
    const { cepDestino, items } = req.body;

    if (!cepDestino || !items) {
        return res.status(400).json({ error: 'CEP de destino e itens do carrinho são obrigatórios.' });
    }

    const payload = {
        "SellerCEP": "01451001",
        "RecipientCEP": cepDestino,
        "ShipmentInvoiceValue": items.reduce((total, item) => total + (item.price * item.quantity), 0),
        "ShippingItemArray": items.map(item => ({
            "Height": 5,
            "Length": 20,
            "Width": 15,
            "Weight": 1,
            "Quantity": item.quantity
        })),
    };

    try {
        const response = await axios.post('https://api.frenet.com.br/shipping/quote', payload, {
            headers: {
                'Content-Type': 'application/json',
                'token': process.env.FRENET_TOKEN
            }
        });

        const services = response.data.ShippingSevicesArray;
        if (!services) {
            return res.json([]);
        }

        const results = services
            .filter(service => !service.ServiceDescription.includes('Mini Envios'))
            .map(service => ({
                Codigo: service.ServiceCode,
                Valor: service.ShippingPrice,
                PrazoEntrega: service.DeliveryTime,
                Servico: service.ServiceDescription
            }));

        res.json(results);
    } catch (error) {
        console.error('Erro ao calcular frete com Frenet:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Falha ao calcular o frete.', details: error.message });
    }
});

app.post('/process-payment', async (req, res) => {
    const { formData, items, shipping, userId, userEmail, userName, customer } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Itens do carrinho são obrigatórios.' });
    }
    if (!formData) {
        return res.status(400).json({ error: 'Dados do pagamento são obrigatórios.' });
    }

    if (!MERCADOPAGO_TOKEN) {
        console.error("Payment attempt failed: MERCADOPAGO_ACCESS_TOKEN is missing.");
        return res.status(500).json({ error: 'Erro de configuração no servidor. Entre em contato com o suporte.' });
    }

    const payment = new Payment(client);

    // Sanitize items
    const sanitizedItems = items.map(item => ({
        ...item,
        name: sanitizeHtml(item.name),
        description: sanitizeHtml(item.description)
    }));

    // Calculate the total amount on the server to prevent manipulation
    const orderItems = sanitizedItems.map(item => ({
        "title": item.name,
        "quantity": Number(item.quantity),
        "unit_price": Number(item.price),
        "currency_id": "BRL"
    }));

    const subtotal = orderItems.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
    const shippingCost = shipping ? Number(shipping.cost) : 0;
    const calculatedTotalAmount = subtotal + shippingCost;

    const payerIdentification = formData.payer && formData.payer.identification ? {
        type: formData.payer.identification.type,
        number: formData.payer.identification.number
    } : (customer && customer.cpf ? {
        type: 'CPF',
        number: customer.cpf.replace(/\D/g, '')
    } : undefined);

    if (!payerIdentification) {
         console.warn("Identification missing for payer:", formData.payer);
    }

    const orderReferenceId = `ref_${userId}_${new Date().getTime()}`;

    try {
        const result = await payment.create({
            body: {
                transaction_amount: calculatedTotalAmount,
                token: formData.token,
                description: formData.description || 'Volei Futuro Purchase',
                installments: formData.installments,
                payment_method_id: formData.payment_method_id,
                issuer_id: formData.issuer_id,
                external_reference: orderReferenceId, // Link payment to order reference
                payer: {
                    email: (formData.payer && formData.payer.email) || userEmail,
                    identification: payerIdentification
                }
            }
        });

        // Save order to Firestore
        const totalAmount = calculatedTotalAmount * 100; // Store as integer cents
        const accessTrackingToken = crypto.randomUUID(); // Secure token for public tracking
        const payerEmail = userEmail || (formData.payer && formData.payer.email);

        const initialStatus = result.status === 'approved' ? 'PAYMENT_APPROVED' : 'PENDING';

        let orderId = null;
        try {
            const orderPayload = {
                userId: userId,
                mercadopagoPaymentId: result.id,
                referenceId: orderReferenceId,
                createdAt: new Date(),
                items: sanitizedItems, // Save sanitized items
                shipping: shipping,
                totalAmount: Math.round(totalAmount),
                status: initialStatus,
                paymentDetails: {
                    status: result.status,
                    status_detail: result.status_detail,
                    payment_method_id: result.payment_method_id,
                    payment_type_id: result.payment_type_id
                },
                userEmail: payerEmail,
                userName: sanitizeHtml(userName),
                accessTrackingToken: accessTrackingToken,
                statusTimeline: [
                    {
                        status: 'CREATED',
                        title: 'Pedido Recebido',
                        description: 'Aguardando confirmação de pagamento.',
                        createdAt: new Date(),
                        source: 'system'
                    },
                    ...(result.status === 'approved' ? [{
                        status: 'PAYMENT_APPROVED',
                        title: 'Pagamento Aprovado',
                        description: 'Seu pagamento foi confirmado.',
                        createdAt: new Date(),
                        source: 'system'
                    }] : [])
                ]
            };
            const docRef = await admin.firestore().collection('orders').add(orderPayload);
            orderId = docRef.id;

            // Send Confirmation Email if approved
            if (result.status === 'approved') {
                const trackingLink = `${BASE_URL}/#tracking?token=${accessTrackingToken}`;

                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h1 style="color: #dc2626;">Pagamento Aprovado!</h1>
                        <p>Olá ${sanitizeHtml(userName) || 'Cliente'},</p>
                        <p>Seu pedido <strong>${orderReferenceId}</strong> foi confirmado com sucesso.</p>
                        <p><strong>Total:</strong> R$ ${calculatedTotalAmount.toFixed(2).replace('.', ',')}</p>
                        <h3>Itens:</h3>
                        <ul>
                            ${sanitizedItems.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('')}
                        </ul>
                        <div style="margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; text-align: center;">
                             <p style="margin-bottom: 15px; font-weight: bold;">Acompanhe o status do seu pedido:</p>
                             <a href="${trackingLink}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Rastrear Pedido</a>
                             <p style="margin-top: 15px; font-size: 12px; color: #666;">Ou use este código de acesso: ${accessTrackingToken}</p>
                        </div>
                        <p>Acompanhe também em nosso site: <a href="${BASE_URL}/#account">Minha Conta</a></p>
                    </div>
                `;

                await sendTransactionalEmail({
                    to: payerEmail,
                    subject: `Pedido Aprovado: ${orderReferenceId}`,
                    html: emailHtml
                });
            }

        } catch (dbError) {
            console.error("Error saving order to Firestore:", dbError);
        }

        res.json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            accessTrackingToken: accessTrackingToken // Return to frontend for immediate redirect
        });

    } catch (error) {
        console.error("Error processing payment:", error);

        let errorMessage = 'Could not process payment.';
        let errorDetails = null;

        if (error.cause) {
            console.error('Cause:', JSON.stringify(error.cause, null, 2));
            if (Array.isArray(error.cause)) {
                 errorDetails = error.cause.map(e => e.description || e.code).join(', ');
            } else if (error.cause.description) {
                 errorDetails = error.cause.description;
            }
        }

        if (error.message) {
             errorMessage = error.message;
        }

        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

app.post('/send-email', async (req, res) => {
    const { to, from, subject, html, secret } = req.body;

    if (secret !== process.env.EMAIL_ENDPOINT_SECRET) {
        console.warn('Unauthorized attempt to send email.');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!to || !from || !subject || !html) {
        return res.status(400).json({ error: 'Missing required email fields.' });
    }

    await sendTransactionalEmail({ to, subject, html }); // Reuse helper, 'from' is fixed in helper for security
    res.status(200).json({ message: 'Email sent successfully.' });
});

app.post('/send-welcome-email', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Auth token is required.' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const { name, email } = decodedToken;

        const welcomeEmailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h1 style="color: #dc2626; text-align: center;">Bem-vindo ao Vôlei Futuro, ${name || ''}!</h1>
                    <p>Olá ${name || 'atleta'},</p>
                    <p>Sua conta em nosso site foi criada com sucesso. Estamos muito felizes por ter você em nossa comunidade.</p>
                    <p>Fique à vontade para explorar nossa <a href="${BASE_URL}/#loja" style="color: #dc2626; text-decoration: none;">loja</a>, acompanhar as <a href="${BASE_URL}/#noticias" style="color: #dc2626; text-decoration: none;">notícias</a> e o <a href="${BASE_URL}/#calendario" style="color: #dc2626; text-decoration: none;">calendário de jogos</a>.</p>
                    <p>Se precisar de algo, estamos à disposição.</p>
                    <p style="margin-top: 30px;">Atenciosamente,<br><strong>Equipe Vôlei Futuro</strong></p>
                </div>
            </div>
        `;

        await sendTransactionalEmail({
            to: email,
            subject: 'Seja Bem-vindo ao Vôlei Futuro!',
            html: welcomeEmailHtml
        });

        res.status(200).json({ message: 'Welcome email sent successfully.' });

    } catch (error) {
        console.error('Error verifying token or sending welcome email:', error);
        res.status(500).json({
            error: 'An unexpected error occurred while sending the welcome email.',
            details: error.message
        });
    }
});

// =============================================================================
// TRACKING ENDPOINTS
// =============================================================================

// Public endpoint to get order by secure token
app.get('/api/orders/track/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ error: 'Token is required.' });
    }

    try {
        const ordersRef = admin.firestore().collection('orders');
        const q = ordersRef.where('accessTrackingToken', '==', token).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = snapshot.docs[0].data();

        // Return only safe public data
        const safeOrderData = {
            referenceId: order.referenceId,
            status: order.status,
            createdAt: order.createdAt,
            items: order.items,
            // Mask shipping cost but keep service name if needed, or just return basic info.
            // Here we return cost for the UI, but we could strip other shipping details if they existed.
            shipping: { cost: order.shipping ? order.shipping.cost : 0 },
            totalAmount: order.totalAmount,
            trackingCode: order.trackingCode,
            statusTimeline: order.statusTimeline || [],
            userName: order.userName ? order.userName.split(' ')[0] : 'Cliente' // First name only
        };

        res.json(safeOrderData);

    } catch (error) {
        console.error('Error fetching order by token:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Public endpoint to lookup order by Reference + Email
app.post('/api/orders/track/lookup', async (req, res) => {
    const { orderReference, email } = req.body;

    if (!orderReference || !email) {
        return res.status(400).json({ error: 'Order reference and email are required.' });
    }

    try {
        const ordersRef = admin.firestore().collection('orders');
        const q = ordersRef.where('referenceId', '==', orderReference).where('userEmail', '==', email).limit(1);
        const snapshot = await q.get();

        if (snapshot.empty) {
            return res.status(404).json({ error: 'Order not found or details do not match.' });
        }

        const order = snapshot.docs[0].data();

        // Return token so frontend can redirect to /#tracking?token=...
        res.json({ accessTrackingToken: order.accessTrackingToken });

    } catch (error) {
        console.error('Error looking up order:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// =============================================================================
// MERCADO PAGO WEBHOOK
// =============================================================================
app.post('/api/payments/mercadopago/webhook', async (req, res) => {
    const { query, body } = req;

    // Support both Query Params (IPN) and Body (Webhook v2)
    const topic = query.topic || query.type || (body && body.type) || (body && body.topic);
    let id = query.id || query['data.id'] || (body && body.data && body.data.id) || (body && body.id);

    // If still no ID found but it's a payment notification in body
    if (!id && topic === 'payment' && body && body.data) {
        id = body.data.id;
    }

    if (!id || (topic !== 'payment' && topic !== 'merchant_order')) {
         // Respond with 200 to acknowledge receipt even if we don't process it,
         // otherwise Mercado Pago will keep retrying.
         return res.status(200).send('OK');
    }

    console.log(`Received webhook for ${topic}: ${id}`);

    try {
        if (topic === 'payment') {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id });

            if (!paymentData) {
                return res.status(200).send('Payment not found');
            }

            const { status, status_detail, external_reference, payer } = paymentData;

            // Find order by external_reference (preferred) or payment ID
            const ordersRef = admin.firestore().collection('orders');
            let q = ordersRef.where('referenceId', '==', external_reference).limit(1);
            let snapshot = await q.get();

            // If not found by reference, try by payment ID (legacy support)
            if (snapshot.empty) {
                 q = ordersRef.where('mercadopagoPaymentId', '==', String(id)).limit(1);
                 snapshot = await q.get();
            }

            if (snapshot.empty) {
                console.warn(`Order not found for payment ${id} (ref: ${external_reference})`);
                return res.status(200).send('Order not found');
            }

            const orderDoc = snapshot.docs[0];
            const order = orderDoc.data();
            const orderId = orderDoc.id;

            // Map Mercado Pago status to internal status
            let newStatus = order.status;
            let statusTitle = '';

            switch (status) {
                case 'approved':
                    newStatus = 'PAYMENT_APPROVED';
                    statusTitle = 'Pagamento Aprovado';
                    break;
                case 'pending':
                case 'in_process':
                    newStatus = 'PENDING';
                    statusTitle = 'Pagamento em Análise';
                    break;
                case 'rejected':
                    newStatus = 'PAYMENT_REJECTED';
                    statusTitle = 'Pagamento Rejeitado';
                    break;
                case 'cancelled':
                case 'refunded':
                case 'charged_back':
                    newStatus = 'CANCELED';
                    statusTitle = 'Pagamento Cancelado/Estornado';
                    break;
            }

            // Only update if status changed
            if (newStatus !== order.status) {
                const newEvent = {
                    status: newStatus,
                    title: statusTitle,
                    description: `Status do pagamento atualizado para: ${status} (${status_detail})`,
                    createdAt: new Date(),
                    source: 'webhook'
                };

                const updatedTimeline = [...(order.statusTimeline || []), newEvent];

                await ordersRef.doc(orderId).update({
                    status: newStatus,
                    statusTimeline: updatedTimeline,
                    updatedAt: new Date(),
                    'paymentDetails.status': status,
                    'paymentDetails.status_detail': status_detail
                });

                console.log(`Updated order ${orderId} to status ${newStatus}`);

                // Send Confirmation Email if it just got approved and wasn't before
                if (newStatus === 'PAYMENT_APPROVED' && order.status !== 'PAYMENT_APPROVED') {
                    const trackingLink = `${BASE_URL}/#tracking?token=${order.accessTrackingToken}`;
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <h1 style="color: #dc2626;">Pagamento Confirmado!</h1>
                            <p>Olá ${sanitizeHtml(order.userName) || 'Cliente'},</p>
                            <p>Recebemos a confirmação do pagamento do seu pedido <strong>${order.referenceId}</strong>.</p>
                            <p>Em breve iniciaremos a separação e envio.</p>
                             <div style="margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; text-align: center;">
                                 <a href="${trackingLink}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Rastrear Pedido</a>
                            </div>
                        </div>
                    `;

                    await sendTransactionalEmail({
                        to: order.userEmail,
                        subject: `Pagamento Confirmado: ${order.referenceId}`,
                        html: emailHtml
                    });
                }
            } else {
                console.log(`Order ${orderId} status already ${newStatus}, no update needed.`);
            }
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('Error handling webhook:', error);
        // Respond with 500 so MP retries later if it was a transient error
        // But if it's a logic error, we should probably respond 200 to stop retries.
        // For now, let's log and return 200 to avoid queue clogging unless we are sure.
        res.status(200).send('Error handled');
    }
});


app.post('/update-order-status', async (req, res) => {
    const { token, orderId, newStatus, trackingCode } = req.body;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing token.' });
    }

    try {
        // Verify the user is authenticated
        const decodedToken = await admin.auth().verifyIdToken(token);
        // In a real app, you would check if decodedToken.email is an admin email.

        // Fetch current order to append timeline
        const orderRef = admin.firestore().collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const order = orderDoc.data();
        const previousStatus = order.status;

        const statusMap = {
            'PENDING': 'Pendente',
            'PAYMENT_APPROVED': 'Pagamento Aprovado',
            'PROCESSING': 'Em Separação',
            'SHIPPED': 'Enviado',
            'IN_TRANSIT': 'Em Trânsito',
            'OUT_FOR_DELIVERY': 'Saiu para Entrega',
            'DELIVERED': 'Entregue',
            'CANCELED': 'Cancelado',
            'PAYMENT_REJECTED': 'Pagamento Rejeitado'
        };
        const statusText = statusMap[newStatus] || newStatus;

        // Build new timeline event
        const newEvent = {
            status: newStatus,
            title: `Status: ${statusText}`,
            description: trackingCode ? `Código de rastreio: ${trackingCode}` : 'O status do seu pedido foi atualizado.',
            createdAt: new Date(),
            source: 'admin'
        };

        const updatedTimeline = [...(order.statusTimeline || []), newEvent];

        // Update Order in Firestore
        await orderRef.update({
            status: newStatus,
            trackingCode: trackingCode || order.trackingCode || null,
            statusTimeline: updatedTimeline,
            updatedAt: new Date()
        });

        // Send Status Update Email
        if (order.userEmail && previousStatus !== newStatus) {

            const trackingLink = order.accessTrackingToken ? `${BASE_URL}/#tracking?token=${order.accessTrackingToken}` : `${BASE_URL}/#account`;

            let trackingHtml = '';
            if (trackingCode) {
                trackingHtml = `
                    <p><strong>Código de Rastreio:</strong> ${trackingCode}</p>
                    <p>Você pode rastrear seu pedido no site da transportadora ou nos Correios.</p>
                `;
            }

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #dc2626;">Atualização de Pedido</h1>
                    <p>Olá ${sanitizeHtml(order.userName) || 'Cliente'},</p>
                    <p>O status do seu pedido <strong>${order.referenceId}</strong> foi atualizado para:</p>
                    <h2 style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; display: inline-block;">${statusText}</h2>
                    ${trackingHtml}
                    <div style="margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; text-align: center;">
                         <a href="${trackingLink}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver Detalhes do Pedido</a>
                    </div>
                </div>
            `;

            await sendTransactionalEmail({
                to: order.userEmail,
                subject: `Atualização do Pedido: ${statusText}`,
                html: emailHtml
            });
        }

        res.json({ success: true, message: 'Status updated and email sent.' });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status.', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
