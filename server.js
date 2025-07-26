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
app.use(bodyParser.json());

const port = process.env.PORT || 3001;


const raffleTickets = {}; 


app.get('/api/current-user', (req, res) => {
  try {
    
    const userId = req.headers['x-user-id'] || req.cookies?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    return res.json({ id: userId });
  } catch (error) {
    console.error('Error in current-user endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/raffle-status', (req, res) => {
  try {
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const tickets = raffleTickets[userId] || 0;
    return res.json({ tickets });
  } catch (error) {
    console.error('Error in raffle-status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/raffle-entry', (req, res) => {
  try {
    const userId = req.body.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    raffleTickets[userId] = (raffleTickets[userId] || 0) + 1;
    return res.json({ success: true, tickets: raffleTickets[userId] });
  } catch (error) {
    console.error('Error in raffle-entry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { 
              name: 'Raffle Ticket',
              metadata: { userId } 
            },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.https://bailore.netlify.app}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.https://bailore.netlify.app}/payment-canceled`,
      metadata: { userId } 
    });
    
    res.json({ sessionUrl: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.post(
  '/api/stripe-webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
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
      const session = event.data.object;
      const userId = session.metadata.userId;

      if (!userId) {
        console.error('No user ID found in webhook metadata');
        return res.status(400).json({ error: 'User ID missing' });
      }

      raffleTickets[userId] = (raffleTickets[userId] || 0) + 1;
      console.log(`✅ Payment received. User ${userId} now has ${raffleTickets[userId]} tickets.`);
    }

    res.json({ received: true });
  }
);

app.listen(port, () => {
  console.log(`Raffle backend listening at http://localhost:${port}`);
});
