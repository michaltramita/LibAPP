import React from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Award, Target, TrendingUp, Users, BarChartHorizontal, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Transcript from '@/components/Transcript';

const ScoreCircle = ({ score = 0 }) => {
  const getScoreColor = (s) => {
    if (s >= 8) return 'text-green-500';
    if (s >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };
  const circumference = 2 * Math.PI * 45; // 2 * pi * radius
  const offset = circumference - (score / 10) * circumference;

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
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
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-bold text-4xl ${getScoreColor(score)}`}>
        {score}
      </div>
    </div>
  );
};

const DimensionScore = ({ name, score, comment, icon: Icon }) => {
  const getScoreColor = (s) => {
    if (s >= 8) return 'bg-green-500';
    if (s >= 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-start gap-3">
      <div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white", getScoreColor(score))}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-semibold text-sm text-slate-800">{name}</h4>
          <span className={cn("font-bold text-sm", getScoreColor(score).replace('bg-', 'text-'))}>{score}/10</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1.5">
          <motion.div
            className={cn("h-1.5 rounded-full", getScoreColor(score))}
            initial={{ width: 0 }}
            animate={{ width: `${score * 10}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
        <p className="text-xs text-slate-600">{comment}</p>
      </div>
    </div>
  );
};


const SessionDetailModal = ({ open, onOpenChange, sessionDetails }) => {
  const dimensionIcons = [Target, BarChartHorizontal, TrendingUp, Award, Users];

  if (!sessionDetails) return null;

  // Ensure feedback is parsed if it's a string, and provide defaults
  let feedback = {};
  if (typeof sessionDetails.feedback === 'string') {
    try {
      feedback = JSON.parse(sessionDetails.feedback);
    } catch (e) {
      console.error("Failed to parse feedback JSON:", e);
    }
  } else if (typeof sessionDetails.feedback === 'object' && sessionDetails.feedback !== null) {
    feedback = sessionDetails.feedback;
  }
  
  const { score, transcript, topic } = sessionDetails;
  const { personalizedMessage, dimensions = [], nextSteps } = feedback;

  // Split nextSteps into a list of bullet points by sentences (periods)
  // Filter out any empty strings that might result from splitting (e.g., if a sentence ends with a period and then another period)
  const nextStepsList = nextSteps ? nextSteps.split('.').filter(item => item.trim() !== '') : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 !rounded-2xl">
        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Left Side - Feedback */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto">
            <DialogHeader className="mb-6 text-left">
              <DialogTitle className="text-2xl font-bold">Detail rozhovoru</DialogTitle>
              <DialogDescription>{topic}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6 bg-slate-50 p-4 rounded-xl border">
              <ScoreCircle score={score} />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Celkové skóre</h3>
                <p className="text-slate-600">{personalizedMessage}</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">Hodnotené dimenzie</h3>
            <div className="space-y-4 mb-6">
              {dimensions.map((dim, index) => (
                <DimensionScore
                  key={dim.name}
                  name={dim.name}
                  score={dim.score}
                  comment={dim.comment}
                  icon={dimensionIcons[index] || Target}
                />
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                 <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><CheckCircle className="text-blue-600 w-5 h-5"/>Ďalšie kroky</h3>
                 {nextStepsList.length > 0 ? (
                   <ul className="list-disc list-inside text-blue-800 text-sm space-y-1">
                     {nextStepsList.map((step, index) => (
                       <li key={index}>{step.trim()}</li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-blue-800 text-sm">Žiadne konkrétne ďalšie kroky neboli navrhnuté.</p>
                 )}
            </div>
          </div>

          {/* Right Side - Transcript */}
          <div className="w-full md:w-1/2 bg-slate-50 border-l overflow-y-auto">
              <Transcript transcript={transcript} />
          </div>
        </div>
        <DialogFooter className="p-4 border-t bg-slate-50/50 sm:justify-end rounded-b-2xl">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Zavrieť</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionDetailModal;