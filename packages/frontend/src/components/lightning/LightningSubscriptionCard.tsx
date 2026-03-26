import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { LightningPaymentButton } from './LightningPaymentButton';

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number; // in satoshis
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
}

export interface LightningSubscriptionCardProps {
  /**
   * Subscription tier details
   */
  tier: SubscriptionTier;

  /**
   * Creator ID
   */
  creatorId: string;

  /**
   * CSS class for the card
   */
  className?: string;

  /**
   * Callback when subscription is successful
   */
  onSubscribe?: (tierId: string, paymentHash: string) => void;

  /**
   * Callback when subscription fails
   */
  onError?: (error: string) => void;

  /**
   * Whether the user is already subscribed to this tier
   */
  isSubscribed?: boolean;
}

export const LightningSubscriptionCard: React.FC<LightningSubscriptionCardProps> = ({
  tier,
  creatorId,
  className = '',
  onSubscribe,
  onError,
  isSubscribed = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Format price display
  const formatPrice = (price: number, interval: string) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(2)} M sats/${interval}`;
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(1)} K sats/${interval}`;
    } else {
      return `${price} sats/${interval}`;
    }
  };

  // Handle successful subscription
  const handleSubscriptionSuccess = (paymentHash: string) => {
    setIsProcessing(false);
    onSubscribe?.(tier.id, paymentHash);
  };

  // Handle subscription error
  const handleSubscriptionError = (error: string) => {
    setIsProcessing(false);
    onError?.(error);
  };

  return (
    <Card className={`w-full ${className} ${tier.popular ? 'border-primary shadow-lg' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{tier.name}</CardTitle>
            <CardDescription>{tier.description}</CardDescription>
          </div>
          {tier.popular && (
            <Badge variant="default" className="bg-primary">
              Popular
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <span className="text-3xl font-bold">{formatPrice(tier.price, tier.interval)}</span>
        </div>

        <ul className="space-y-2 mb-6">
          {tier.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <svg
                className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {isSubscribed ? (
          <Button disabled className="w-full">
            Currently Subscribed
          </Button>
        ) : (
          <LightningPaymentButton
            creatorId={creatorId}
            amount={tier.price}
            description={`${tier.interval.charAt(0).toUpperCase() + tier.interval.slice(1)} subscription to ${tier.name}`}
            buttonText={isProcessing ? 'Processing...' : `Subscribe with Lightning`}
            disabled={isProcessing}
            className="w-full"
            onSuccess={handleSubscriptionSuccess}
            onError={handleSubscriptionError}
          />
        )}
      </CardFooter>
    </Card>
  );
};
