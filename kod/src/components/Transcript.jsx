import React from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const Transcript = ({ transcript }) => {
  if (!transcript || transcript.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold text-slate-700">Prepis nie je k dispozícii</p>
        <p className="text-sm text-slate-500">Pre tento rozhovor nebol zaznamenaný žiadny prepis.</p>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
       <h3 className="text-lg font-bold text-slate-900 mb-4 sticky top-0 bg-slate-50 py-2">Prepis rozhovoru</h3>
      <div className="space-y-4 flex-grow overflow-y-auto">
        {transcript.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-start gap-3 max-w-sm",
              message.type === 'salesman' ? 'ml-auto flex-row-reverse' : ''
            )}
          >
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.type === 'salesman' ? 'bg-[#B81547] text-white' : 'bg-slate-200 text-slate-600'
            )}>
              {message.type === 'salesman' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={cn(
                'rounded-xl px-4 py-2 text-sm',
                message.type === 'salesman'
                  ? 'bg-[#B81547] text-white rounded-br-none'
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
              )}
            >
              {message.text}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Transcript;