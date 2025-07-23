import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

const app = express();
app.use(cors());

const port = 3001;

let raffleTickets = { 123: 0 };

app.use(cors());
app.use(bodyParser.json());

app.get('/api/raffle-status', (req, res) => {
  const userId = req.query.userId;
  const tickets = raffleTickets[userId] || 0;
  return res.json({ tickets });
});

app.post('/api/raffle-entry', (req, res) => {
  const userId = req.body.userId;
  raffleTickets[userId] = (raffleTickets[userId] || 0) + 1;
  return res.json({ success: true, tickets: raffleTickets[userId] });
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Raffle Ticket' },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      success_url: 'http://bailore.netlify.app/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://bailore.netlify.app/payment-canceled',
    });
    res.json({ sessionUrl: session.url }); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});
app.post(
  '/api/stripe-webhook',
  bodyParser.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed.', err);
      return res.sendStatus(400);
    }

    if (event.type === 'checkout.session.completed') {
      const userId = 123; 
      raffleTickets[userId] = (raffleTickets[userId] || 0) + 1;
      console.log(`✅ Payment received. User ${userId} now has ${raffleTickets[userId]} tickets.`);
    }

    res.json({ received: true });
  }
);

app.listen(port, () => {
  console.log(`Raffle backend listening at http://localhost:${port}`);
});
