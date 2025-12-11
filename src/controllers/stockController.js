const analysisService = require('../services/analysisService');

exports.analyze = async (req, res) => {
  try {
    const { ticker } = req.params;
    
    // Basic validation
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker symbol is required' });
    }

    // Call the Service
    const data = await analysisService.performAnalysis(ticker);
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};