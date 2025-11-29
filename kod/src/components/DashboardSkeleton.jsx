import React from 'react';

const SkeletonElement = ({ className }) => <div className={`bg-slate-200 rounded-md animate-pulse ${className}`} />;

const DashboardSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
            <SkeletonElement className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonElement className="h-4 w-3/4" />
              <SkeletonElement className="h-6 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Recent Sessions Skeleton */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <SkeletonElement className="h-7 w-1/3 mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <SkeletonElement className="h-5 w-1/2" />
                <SkeletonElement className="h-4 w-3/4" />
              </div>
              <div className="flex items-center gap-4">
                <SkeletonElement className="h-8 w-16 rounded-md" />
                <SkeletonElement className="h-6 w-24 rounded-md" />
                <SkeletonElement className="h-8 w-20 rounded-md ml-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;