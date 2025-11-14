const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/creatives', require('./routes/creatives'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/csv', require('./routes/csv'));
app.use('/api/monitoring', require('./routes/monitoring'));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/duplication', require('./routes/duplication'));
app.use('/api/kpi', require('./routes/kpi'));

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start performance monitoring when server starts (disabled for debugging)
// const performanceMonitor = require('./services/performanceMonitor');
// performanceMonitor.start();

app.listen(PORT, () => {
  console.log(`🚀 Meta Ads Launcher running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔍 Performance monitoring active`);
});