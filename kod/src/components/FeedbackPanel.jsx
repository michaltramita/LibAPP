import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Award, Target, TrendingUp, Users, RefreshCw, BarChartHorizontal, Home } from 'lucide-react'; // Added Home icon
import { cn } from '@/lib/utils';

const mockData = {
  score: 7, // Changed to whole number
  personalizedMessage: "Skvelá práca! Ukázali ste silné základy, zamerajte sa na prácu s námietkami a budete neporaziteľný.",
  dimensions: [
    {
      name: 'Zisťovanie potrieb',
      score: 8,
      comment: 'Efektívne ste používali otvorené otázky na zistenie kľúčových potrieb klienta.'
    },
    {
      name: 'Prezentácia hodnoty',
      score: 7,
      comment: 'Jasne ste komunikovali hodnotu, ale mohli by ste viac prepojiť prínosy s konkrétnymi potrebami klienta.'
    },
    {
      name: 'Práca s námietkami',
      score: 5,
      comment: 'Námietku ste síce adresovali, ale chýbala väčšia empatia a potvrdenie klientovej obavy pred ponúknutím riešenia.'
    },
    {
      name: 'Uzatváranie/dohoda',
      score: 6,
      comment: 'Pokúsili ste sa o uzavretie, ale návrh ďalších krokov mohol byť sebavedomejší a konkrétnejší.'
    },
    {
      name: 'Prispôsobenie sa typu klienta',
      score: 9,
      comment: 'Výborne ste prispôsobili svoj komunikačný štýl a tón klientovi typu "I".'
    }
  ],
  nextSteps: 'Zamerajte sa na techniky zvládania námietok. Skúste si scenár zopakovať a sústreďte sa na empatiu.'
};

const ScoreCircle = ({ score }) => {
  const getScoreColor = (s) => {
    if (s >= 8) return 'text-green-500';
    if (s >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };
  const circumference = 2 * Math.PI * 45; // 2 * pi * radius
  const offset = circumference - (score / 10) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle
          className="text-slate-200"
          strokeWidth="8"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
        />
        <motion.circle
          className={getScoreColor(score)}
          strokeWidth="8"
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-bold text-4xl ${getScoreColor(score)}`}>
        {score}
      </div>
    </div>
  );
};

const DimensionScore = ({ name, score, comment, icon: Icon, delay }) => {
  const getScoreColor = (s) => {
    if (s >= 8) return 'bg-green-500';
    if (s >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  return (
    <motion.div 
      className="flex items-start gap-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-white", getScoreColor(score))}>
            <Icon className="w-6 h-6" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-slate-800">{name}</h4>
          <span className={cn("font-bold text-lg", getScoreColor(score).replace('bg-', 'text-'))}>{score}/10</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
            <motion.div
                className={cn("h-2 rounded-full", getScoreColor(score))}
                initial={{ width: 0 }}
                animate={{ width: `${score * 10}%` }}
                transition={{ duration: 1, delay: delay + 0.3 }}
            />
        </div>
        <p className="text-sm text-slate-600">{comment}</p>
      </div>
    </motion.div>
  );
};


const FeedbackPanel = ({ evaluation: propEvaluation, onRestart, onReturnToDashboard }) => {
  const evaluation = propEvaluation || mockData;
  const dimensionIcons = [Target, BarChartHorizontal, TrendingUp, Award, Users];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white text-center relative">
            <div className="absolute inset-0 bg-[url('https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/grid.svg')] opacity-10 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              className="flex flex-col items-center justify-center"
            >
                <ScoreCircle score={evaluation.score} />
                <h2 className="text-3xl font-bold mt-4">Vyhodnotenie rozhovoru</h2>
                <p className="text-lg text-slate-300 mt-1 max-w-2xl">{evaluation.personalizedMessage}</p>
            </motion.div>
        </div>

        {/* Detailed Scores */}
        <div className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
            {evaluation.dimensions.map((dim, index) => (
                <DimensionScore 
                  key={dim.name}
                  name={dim.name}
                  score={dim.score}
                  comment={dim.comment}
                  icon={dimensionIcons[index]}
                  delay={0.5 + index * 0.15}
                />
            ))}
        </div>

        {/* Next Steps & Action Buttons */}
        <div className="p-8 border-t border-slate-100 bg-slate-50">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Odporúčané ďalšie kroky</h3>
            <p className="text-slate-600 mb-6">{evaluation.nextSteps}</p>
            <div className="flex flex-col sm:flex-row gap-4">
                <Button
                    onClick={onRestart}
                    className="flex-1 py-6 text-lg font-semibold bg-[#B81547] hover:bg-[#9e123d] text-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Začať nové stretnutie
                </Button>
                <Button
                    onClick={onReturnToDashboard}
                    variant="outline"
                    className="flex-1 py-6 text-lg font-semibold bg-white text-slate-700 border-slate-300 hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    <Home className="w-5 h-5 mr-2" />
                    Vrátiť sa do dashboardu
                </Button>
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FeedbackPanel;