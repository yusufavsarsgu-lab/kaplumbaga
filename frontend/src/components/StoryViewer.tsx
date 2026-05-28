import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStoryStore } from '../store/storyStore';
import { socket } from '../services/socket';

interface Props {
  storyId: string;
  onClose: () => void;
}

const StoryViewer: React.FC<Props> = ({ storyId, onClose }) => {
  const stories = useStoryStore((state) => state.stories);
  const markViewed = useStoryStore((state) => state.markViewed);
  const [currentIndex, setCurrentIndex] = useState(0);

  const userStories = React.useMemo(() => {
    const target = stories.find((s) => s.id === storyId);
    if (!target) return [];
    return stories
      .filter((s) => s.userId === target.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stories, storyId]);

  const current = userStories[currentIndex];

  useEffect(() => {
    if (current && !current.viewed) {
      socket.emit('view_story', { storyId: current.id });
      markViewed(current.id);
    }
  }, [current, markViewed]);

  useEffect(() => {
    if (userStories.length === 0) return;
    const timer = setTimeout(() => {
      if (currentIndex < userStories.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        onClose();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentIndex, userStories.length, onClose]);

  if (userStories.length === 0 || !current) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Progress bar */}
      <div className="flex gap-1 p-2">
        {userStories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/30">
            <div
              className="h-full rounded-full bg-white transition-all duration-100"
              style={{
                width: i < currentIndex ? '100%' : i === currentIndex ? '60%' : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <img
            src={current.userAvatar || '/avatar.png'}
            alt=""
            className="h-8 w-8 rounded-full border border-white/20 object-cover"
          />
          <span className="text-sm font-medium text-white">
            {current.userName || 'User'}
          </span>
          <span className="text-xs text-white/60">
            {new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <button onClick={onClose} className="rounded-full p-1 text-white hover:bg-white/10">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media */}
      <div className="flex flex-1 items-center justify-center">
        {current.type === 'image' ? (
          <img
            src={current.mediaData}
            alt="Story"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <video src={current.mediaData} className="max-h-full max-w-full" autoPlay muted controls />
        )}
      </div>

      {current.caption && (
        <div className="px-4 pb-6 pt-2 text-center text-sm text-white">{current.caption}</div>
      )}
    </div>
  );
};

export default StoryViewer;
