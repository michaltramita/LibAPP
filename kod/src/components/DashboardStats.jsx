import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Star, CheckCircle, Users } from 'lucide-react';

const StatCard = ({ icon, title, value, color, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4"
    >
      <div className={`p-3 rounded-full ${color.bg}`}>
        {React.cloneElement(icon, { className: `w-6 h-6 ${color.text}` })}
      </div>
      <div>
        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </motion.div>
  );
};


const DashboardStats = ({ stats }) => {
  // Debugging log as requested
  console.log("Stats data received in DashboardStats:", stats);

  const getMostFrequentClient = () => {
    const discTypes = stats.sessions_by_disc_type || {};
    if (Object.keys(discTypes).length === 0) {
      return 'N/A';
    }
    return Object.entries(discTypes).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  };

  const cardData = [
    {
      icon: <BarChart />,
      title: "Celkový počet tréningov",
      value: stats.total_sessions,
      color: { bg: 'bg-blue-100', text: 'text-blue-600' }
    },
    {
      icon: <Star />,
      title: "Priemerné skóre",
      value: `${stats.avg_score} / 10`,
      color: { bg: 'bg-yellow-100', text: 'text-yellow-600' }
    },
    {
      icon: <CheckCircle />,
      title: "Miera úspešnosti",
      value: `${stats.success_rate}%`,
      color: { bg: 'bg-green-100', text: 'text-green-600' }
    },
    {
      icon: <Users />,
      title: "Najčastejší klient",
      value: getMostFrequentClient(),
      color: { bg: 'bg-purple-100', text: 'text-purple-600' }
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cardData.map((card, index) => (
        <StatCard 
          key={index}
          icon={card.icon}
          title={card.title}
          value={card.value}
          color={card.color}
          delay={index}
        />
      ))}
    </div>
  );
};

export default DashboardStats;