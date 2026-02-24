require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

    // Calculate the total amount on the server to prevent manipulation
    const orderItems = items.map(item => ({
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

    try {
        const result = await payment.create({
            body: {
                transaction_amount: calculatedTotalAmount,
                token: formData.token,
                description: formData.description || 'Volei Futuro Purchase',
                installments: formData.installments,
                payment_method_id: formData.payment_method_id,
                issuer_id: formData.issuer_id,
                payer: {
                    email: (formData.payer && formData.payer.email) || userEmail,
                    identification: payerIdentification
                }
            }
        });

        // Save order to Firestore
        const orderReferenceId = `ref_${userId}_${new Date().getTime()}`;
        const totalAmount = calculatedTotalAmount * 100; // Store as integer cents

        try {
            const orderPayload = {
                userId: userId,
                mercadopagoPaymentId: result.id,
                referenceId: orderReferenceId,
                createdAt: new Date(),
                items: items, // Passed from frontend
                shipping: shipping,
                totalAmount: Math.round(totalAmount),
                status: result.status === 'approved' ? 'PAYMENT_APPROVED' : 'PENDING', // Basic mapping
                paymentDetails: {
                    status: result.status,
                    status_detail: result.status_detail,
                    payment_method_id: result.payment_method_id,
                    payment_type_id: result.payment_type_id
                }
            };
            await admin.firestore().collection('orders').add(orderPayload);
        } catch (dbError) {
            console.error("Error saving order to Firestore:", dbError);
        }

        res.json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail
        });

    } catch (error) {
        console.error("Error processing payment:", error);

        let errorMessage = 'Could not process payment.';
        let errorDetails = null;

        if (error.cause) {
            console.error('Cause:', JSON.stringify(error.cause, null, 2));
            // Try to extract a meaningful message from Mercado Pago error response
            if (Array.isArray(error.cause)) {
                 errorDetails = error.cause.map(e => e.description || e.code).join(', ');
            } else if (error.cause.description) {
                 errorDetails = error.cause.description;
            }
        }

        // Also check if error.message is useful
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

    const msg = { to, from, subject, html };

    try {
        await sgMail.send(msg);
        res.status(200).json({ message: 'Email sent successfully.' });
    } catch (error) {
        console.error('Error sending email with SendGrid:', error);
        if (error.response) {
            console.error(error.response.body)
        }
        res.status(500).json({ error: 'Failed to send email.' });
    }
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
                    <p>Fique à vontade para explorar nossa <a href="https://volei-futuro.onrender.com/#loja" style="color: #dc2626; text-decoration: none;">loja</a>, acompanhar as <a href="https://volei-futuro.onrender.com/#noticias" style="color: #dc2626; text-decoration: none;">notícias</a> e o <a href="https://volei-futuro.onrender.com/#calendario" style="color: #dc2626; text-decoration: none;">calendário de jogos</a>.</p>
                    <p>Se precisar de algo, estamos à disposição.</p>
                    <p style="margin-top: 30px;">Atenciosamente,<br><strong>Equipe Vôlei Futuro</strong></p>
                </div>
            </div>
        `;

        const msg = {
            to: email,
            from: 'contato@voleifuturo.com', // This MUST be a verified sender in your SendGrid account
            subject: 'Seja Bem-vindo ao Vôlei Futuro!',
            html: welcomeEmailHtml,
        };

        await sgMail.send(msg);
        res.status(200).json({ message: 'Welcome email sent successfully.' });

    } catch (error) {
        console.error('Error verifying token or sending welcome email:', error);
        // Check if the error is from SendGrid and has detailed info
        if (error.response && error.response.body) {
            return res.status(500).json({
                error: 'Failed to send welcome email via SendGrid.',
                details: error.response.body.errors
            });
        }
        // Check if it's a token verification error
        if (error.code && error.code.startsWith('auth/')) {
            return res.status(401).json({
                error: 'Invalid Firebase authentication token.',
                details: error.message
            });
        }
        // Generic error
        res.status(500).json({
            error: 'An unexpected error occurred while sending the welcome email.',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
