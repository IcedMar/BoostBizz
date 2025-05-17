// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const { lipaNaMpesaOnline } = require('./utils/daraja');
const db = require('./firebase');

app.use(cors());
app.use(bodyParser.json());

app.post('/api/pay', async (req, res) => {
  const { phone, userId, amount } = req.body;

  if (!phone || !userId || !amount) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    const result = await lipaNaMpesaOnline(phone, amount, `BoostBizz Subscription - ${userId}`);

    if (result.ResponseCode === '0') {
      await db.collection('mpesa_payments').add({
        userId,
        phone,
        amount,
        status: 'pending',
        checkoutRequestID: result.CheckoutRequestID,
        timestamp: new Date()
      });

      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, message: 'STK Push failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/api/mpesa-callback', async (req, res) => {
  const body = req.body;
  const stkCallback = body?.Body?.stkCallback;

  if (!stkCallback) return res.status(400).send('Invalid callback');

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

  try {
    const snapshot = await db
      .collection('mpesa_payments')
      .where('checkoutRequestID', '==', CheckoutRequestID)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];

      const updateData = {
        status: ResultCode === 0 ? 'success' : 'failed',
        resultDesc: ResultDesc,
        updatedAt: new Date()
      };

      if (ResultCode === 0 && CallbackMetadata?.Item) {
        CallbackMetadata.Item.forEach(item => {
          if (item.Name === 'MpesaReceiptNumber') updateData.receipt = item.Value;
          if (item.Name === 'TransactionDate') updateData.transactionDate = item.Value;
          if (item.Name === 'PhoneNumber') updateData.confirmedPhone = item.Value;
        });
      }

      await doc.ref.update(updateData);
    }

    res.json({ message: 'Callback received successfully' });
  } catch (err) {
    console.error('Callback handling error:', err);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
