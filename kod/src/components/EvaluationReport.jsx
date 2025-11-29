import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Award, TrendingUp, Target, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const EvaluationReport = ({ evaluation, onRestart }) => {
  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Adjusted gradients to be simpler or match theme, but kept score logic
  const getScoreGradient = (score) => {
    if (score >= 8) return 'bg-green-600';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-w-4xl mx-auto"
    >
      <div className={`${getScoreGradient(evaluation.score)} p-8 text-white text-center`}>
        <Award className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-2">Hodnotenie stretnutia</h2>
        <p className="text-lg opacity-90">Váš výkon bol analyzovaný</p>
      </div>

      <div className="p-8 space-y-8">
        <div className="text-center">
          <div className="inline-block">
            <div className={`text-7xl font-bold ${getScoreColor(evaluation.score)} mb-2`}>
              {evaluation.score}
            </div>
            <div className="text-slate-500 text-sm">z 10</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-green-50 rounded-xl p-6 border-2 border-green-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-green-900">Silné stránky</h3>
            </div>
            <ul className="space-y-2">
              {evaluation.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2 text-green-800">
                  <span className="text-green-600 mt-1">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-orange-50 rounded-xl p-6 border-2 border-orange-100"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-orange-600" />
              <h3 className="text-xl font-bold text-orange-900">Oblasti na zlepšenie</h3>
            </div>
            <ul className="space-y-2">
              {evaluation.improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2 text-orange-800">
                  <span className="text-orange-600 mt-1">•</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-blue-50 rounded-xl p-6 border-2 border-blue-100"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-blue-900">Odporúčania</h3>
          </div>
          <ul className="space-y-3">
            {evaluation.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-3 text-blue-800">
                <span className="text-blue-600 font-bold mt-1">{index + 1}.</span>
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-purple-50 rounded-xl p-6 border-2 border-purple-100"
        >
          <h3 className="text-xl font-bold text-purple-900 mb-3">Ďalšie kroky</h3>
          <p className="text-purple-800 leading-relaxed">{evaluation.nextSteps}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            onClick={onRestart}
            className="w-full py-6 text-lg font-semibold bg-[#B81547] hover:bg-[#9e123d] text-white transition-all shadow-lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Začať nové stretnutie
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EvaluationReport;