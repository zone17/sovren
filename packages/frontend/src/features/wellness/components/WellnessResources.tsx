import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ResourceCategory, WellnessResource } from '../types';

const RESOURCES: WellnessResource[] = [
  {
    id: '1',
    title: 'Creator Burnout Recovery Group',
    description:
      'Peer support community for creators experiencing burnout. Weekly virtual meetups and resources.',
    category: 'communities',
    url: 'https://creatorhealth.community',
  },
  {
    id: '2',
    title: 'The Sustainable Creator',
    description:
      'Evidence-based guide to sustainable content creation without sacrificing wellbeing.',
    category: 'articles',
    url: 'https://sustainablecreator.guide',
  },
  {
    id: '3',
    title: 'Focus Timer for Creators',
    description:
      'Pomodoro-based timer designed for creative work. Includes break reminders and session tracking.',
    category: 'tools',
    url: 'https://focustimer.app',
  },
  {
    id: '4',
    title: 'Creator Mental Health Hotline',
    description: '24/7 confidential support for creators experiencing mental health challenges.',
    category: 'crisis',
    url: 'https://creatorwellness.org/helpline',
  },
  {
    id: '5',
    title: 'Mindful Content Creation',
    description: 'Research on maintaining creative output while prioritizing mental health.',
    category: 'articles',
    url: 'https://mindfulcreator.com',
  },
  {
    id: '6',
    title: 'Batch Content Planner',
    description: 'Tool for planning and batching content to reduce daily creative pressure.',
    category: 'tools',
    url: 'https://batchplanner.app',
  },
  {
    id: '7',
    title: 'Creator Economy Support Network',
    description: 'Online community focused on the unique challenges of the creator economy.',
    category: 'communities',
    url: 'https://creatorsupport.net',
  },
  {
    id: '8',
    title: 'Crisis Text Line',
    description: 'Free crisis counseling via text message. Text HOME to 741741.',
    category: 'crisis',
    url: 'https://www.crisistextline.org',
  },
];

const CATEGORY_CONFIG: Record<ResourceCategory, { label: string; color: string; bg: string }> = {
  communities: { label: 'Community', color: 'text-blue-700', bg: 'bg-blue-100' },
  articles: { label: 'Article', color: 'text-purple-700', bg: 'bg-purple-100' },
  tools: { label: 'Tool', color: 'text-green-700', bg: 'bg-green-100' },
  crisis: { label: 'Crisis Support', color: 'text-red-700', bg: 'bg-red-100' },
};

const ALL_CATEGORIES: ResourceCategory[] = ['communities', 'articles', 'tools', 'crisis'];

interface ResourceCardProps {
  resource: WellnessResource;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource }) => {
  const config = CATEGORY_CONFIG[resource.category];
  return (
    <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-foreground flex-1">{resource.title}</h4>
        <Badge className={`${config.bg} ${config.color} text-[10px] ml-2 shrink-0`}>
          {config.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{resource.description}</p>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Visit resource
      </a>
    </div>
  );
};

interface WellnessResourcesProps {
  category?: ResourceCategory;
}

export const WellnessResources: React.FC<WellnessResourcesProps> = ({
  category: initialCategory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>(
    initialCategory ?? 'all'
  );

  const filtered =
    selectedCategory === 'all'
      ? RESOURCES
      : RESOURCES.filter((r) => r.category === selectedCategory);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Wellness Resources</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 flex-wrap">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className="text-xs h-7"
          >
            All
          </Button>
          {ALL_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="text-xs h-7"
              >
                {config.label}
              </Button>
            );
          })}
        </div>

        {/* Resource grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No resources found for this category.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default WellnessResources;
