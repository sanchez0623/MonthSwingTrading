import React from 'react';
import AppLayout from './components/Layout/AppLayout';
import StockScreening from './components/Screening/StockScreening';
import StockScoring from './components/Scoring/StockScoring';
import TradingStrategy from './components/Strategy/TradingStrategy';
import StrategyClock from './components/Clock/StrategyClock';
import { useAppStore } from './store/useAppStore';

function App() {
  const { activeTab } = useAppStore();

  const renderContent = () => {
    switch (activeTab) {
      case 'screening':
        return <StockScreening />;
      case 'scoring':
        return <StockScoring />;
      case 'strategy':
        return <TradingStrategy />;
      case 'clock':
        return <StrategyClock />;
      default:
        return <StockScreening />;
    }
  };

  return <AppLayout>{renderContent()}</AppLayout>;
}

export default App;
