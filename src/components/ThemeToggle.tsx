import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all relative overflow-hidden group"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      <motion.div
        initial={false}
        animate={{ y: theme === 'light' ? 0 : -40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-col items-center"
      >
        <div className="h-10 flex items-center justify-center">
          <Sun size={20} />
        </div>
        <div className="h-10 flex items-center justify-center">
          <Moon size={20} />
        </div>
      </motion.div>
    </button>
  );
}
