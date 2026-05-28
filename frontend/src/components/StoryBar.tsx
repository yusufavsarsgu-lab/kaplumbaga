import React from 'react';
import { Plus } from 'lucide-react';
import { useStoryStore } from '../store/storyStore';
interface Props {
  onCreate: () => void;
  onView: (storyId: string) => void;
}

const StoryBar: React.FC<Props> = ({ onCreate, onView }) => {
  const stories = useStoryStore((state) => state.stories);

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof stories>();
    for (const s of stories) {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId)!.push(s);
    }
    return Array.from(map.entries());
  }, [stories]);

  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-2 scrollbar-hide">
      {/* Add story */}
      <button
        onClick={onCreate}
        className="flex flex-shrink-0 flex-col items-center gap-1"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-turtle-700 bg-cream-50">
          <Plus className="h-6 w-6 text-turtle-700" />
        </div>
        <span className="text-[10px] text-gray-600">Hikaye</span>
      </button>

      {/* Story circles */}
      {grouped.map(([userId, userStories]) => {
        const latest = userStories[0];
        const hasUnviewed = userStories.some((s) => !s.viewed);
        return (
          <button
            key={userId}
            onClick={() => onView(latest.id)}
            className="flex flex-shrink-0 flex-col items-center gap-1"
          >
            <div
              className={`h-16 w-16 rounded-full p-[3px] ${
                hasUnviewed
                  ? 'bg-gradient-to-tr from-turtle-500 to-turtle-700'
                  : 'bg-gray-300'
              }`}
            >
              <img
                src={latest.userAvatar || '/avatar.png'}
                alt={latest.userName || 'User'}
                className="h-full w-full rounded-full border-2 border-white object-cover"
              />
            </div>
            <span className="max-w-[64px] truncate text-[10px] text-gray-600">
              {latest.userName || 'User'}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default StoryBar;
