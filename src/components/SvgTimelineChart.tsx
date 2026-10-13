import React, { useState } from 'react';

interface ScatterPoint {
  assignee: string;
  timeHour: number; // 0 - 24
  timeLabel: string;
  subtaskName: string;
  taskId: string;
  isBurst: boolean;
  actualTime: number;
}

interface SvgTimelineChartProps {
  points: ScatterPoint[];
  assignees: string[];
}

export const SvgTimelineChart: React.FC<SvgTimelineChartProps> = ({ points, assignees }) => {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  if (assignees.length === 0 || points.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 bg-zinc-900/50 rounded-xl border border-zinc-800">
        サブタスク完了時刻のデータがありません。
      </div>
    );
  }

  const paddingLeft = 140;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  const rowHeight = 44;
  const chartHeight = paddingTop + paddingBottom + assignees.length * rowHeight;
  const chartWidth = 900;

  const usableWidth = chartWidth - paddingLeft - paddingRight;

  const getX = (hour: number) => {
    const clamped = Math.max(0, Math.min(24, hour));
    return paddingLeft + (clamped / 24) * usableWidth;
  };

  const getY = (assigneeIndex: number) => {
    return paddingTop + assigneeIndex * rowHeight + rowHeight / 2;
  };

  const hoursMarks = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  return (
    <div className="relative w-full overflow-x-auto bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 shadow-inner">
      <div className="flex items-center justify-between mb-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200 tracking-wider">
            時間別サブタスク完了プロット（00:00 〜 24:00）
          </span>
          <span className="text-zinc-500">| プロット1点は完了サブタスク1件</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>正常</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block"></span>
            <span className="text-rose-400 font-medium">連続一括完了（送信不正の疑い）</span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto text-xs select-none"
        style={{ minWidth: '700px' }}
      >
        {/* Background Grid Lines for Hours */}
        {hoursMarks.map((h) => {
          const x = getX(h);
          return (
            <g key={`hour-${h}`}>
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={chartHeight - paddingBottom}
                stroke="#27272a"
                strokeWidth={h % 6 === 0 ? '1.5' : '1'}
                strokeDasharray={h % 6 === 0 ? '' : '3 3'}
              />
              <text
                x={x}
                y={chartHeight - paddingBottom + 18}
                fill="#71717a"
                textAnchor="middle"
                fontSize="11"
                fontFamily="sans-serif"
              >
                {String(h).padStart(2, '0')}:00
              </text>
            </g>
          );
        })}

        {/* Work Hour Highlights (08:00 - 18:00 standard shift) */}
        <rect
          x={getX(8)}
          y={paddingTop}
          width={getX(18) - getX(8)}
          height={chartHeight - paddingTop - paddingBottom}
          fill="#3b82f6"
          fillOpacity="0.03"
        />

        {/* Assignee Rows */}
        {assignees.map((user, idx) => {
          const y = getY(idx);
          return (
            <g key={`user-row-${user}`}>
              <line
                x1={paddingLeft}
                y1={y + rowHeight / 2}
                x2={chartWidth - paddingRight}
                y2={y + rowHeight / 2}
                stroke="#18181b"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 14}
                y={y + 4}
                fill="#e4e4e7"
                textAnchor="end"
                fontSize="11"
                fontWeight="500"
              >
                {user.length > 16 ? user.slice(0, 15) + '…' : user}
              </text>
            </g>
          );
        })}

        {/* Scatter Dots */}
        {points.map((pt, i) => {
          const assigneeIndex = assignees.indexOf(pt.assignee);
          if (assigneeIndex === -1) return null;
          const cx = getX(pt.timeHour);
          const cy = getY(assigneeIndex);

          const isHovered = hoveredPoint === pt;

          return (
            <circle
              key={`dot-${i}`}
              cx={cx}
              cy={cy}
              r={pt.isBurst ? (isHovered ? 6.5 : 4.5) : (isHovered ? 5.5 : 3.5)}
              fill={pt.isBurst ? '#f43f5e' : '#10b981'}
              fillOpacity={pt.isBurst ? 0.9 : 0.75}
              stroke={pt.isBurst ? '#fff' : '#064e3b'}
              strokeWidth={pt.isBurst ? 1.5 : 1}
              className="cursor-pointer transition-all duration-150 hover:opacity-100"
              onMouseEnter={(e) => {
                setHoveredPoint(pt);
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredPoint && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs p-2.5 rounded-lg shadow-xl backdrop-blur-md"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
        >
          <div className="font-semibold text-emerald-400 mb-1 flex items-center justify-between gap-3">
            <span>{hoveredPoint.assignee}</span>
            <span className="text-zinc-400 font-mono">{hoveredPoint.timeLabel}</span>
          </div>
          <div className="text-zinc-200 font-medium truncate max-w-xs mb-1">
            {hoveredPoint.subtaskName}
          </div>
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <span>ID: <b className="font-mono text-zinc-200">{hoveredPoint.taskId}</b></span>
            <span>•</span>
            <span>実績: <b className="text-zinc-200">{hoveredPoint.actualTime}分</b></span>
            {hoveredPoint.isBurst && (
              <span className="text-rose-400 font-semibold bg-rose-950/60 px-1 py-0.5 rounded border border-rose-800/60">
                一括完了
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
