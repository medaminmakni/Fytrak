import { ToastService } from "../../components/Toast";
import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions} from "react-native";
import { GenderStep } from './steps/GenderStep';
import { BirthdayStep } from './steps/BirthdayStep';
import { BodyMetricsStep } from './steps/BodyMetricsStep';
import { GoalStep } from './steps/GoalStep';
import { LevelStep } from './steps/LevelStep';
import { SuccessStep } from './steps/SuccessStep';
import { OnboardingData, OnboardingStep } from '../../types/onboarding';
import { calculateNutritionPlan } from '../../utils/calculators';

const { width } = Dimensions.get('window');

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => Promise<void>;
  onExit: () => void;
}

export function OnboardingFlow({ onComplete, onExit }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('GENDER');
  const [formData, setFormData] = useState<OnboardingData>({
    gender: null,
    birthday: '2000-01-01',
    height: 160,
    weight: 60,
    goal: null,
    level: null,
  });
  const [isCompleting, setIsCompleting] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const direction = useRef<'next' | 'back' | null>(null);

  useEffect(() => {
    if (!direction.current) return;
    
    slideAnim.setValue(direction.current === 'next' ? width : -width);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    direction.current = null;
  }, [currentStep, slideAnim]);

  const handleTransition = (nextStep: OnboardingStep | null, updatedData: OnboardingData, isNext: boolean) => {
    if (!nextStep) {
      void handleFinish(updatedData);
      return;
    }

    setFormData(updatedData);
    direction.current = isNext ? 'next' : 'back';
    Animated.timing(slideAnim, {
      toValue: isNext ? -width : width,
      duration: 200,
      useNativeDriver: true
    }).start(() => setCurrentStep(nextStep));
  };

  const handleFinish = async (data: OnboardingData = formData) => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await onComplete(data);
      // On success, the parent (RootNavigator) reacts to profileCompleted
      // becoming true in Firestore and unmounts this screen — no explicit
      // navigation needed here.
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setIsCompleting(false);
      ToastService.error(
        'Could Not Save Profile',
        'Please check your connection and try again.'
      );
    }
  };

  const handleNext = (data?: any) => {
    const updated = { ...formData };
    switch (currentStep) {
      case 'GENDER':   return handleTransition('BIRTHDAY', { ...updated, gender: data }, true);
      case 'BIRTHDAY': return handleTransition('METRICS',  { ...updated, birthday: data }, true);
      case 'METRICS':  return handleTransition('GOAL',     { ...updated, ...data }, true);
      case 'GOAL':     return handleTransition('LEVEL',    { ...updated, goal: data }, true);
      case 'LEVEL':    return handleTransition('SUCCESS',  { ...updated, level: data }, true);
      case 'SUCCESS':  return handleFinish();
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'GENDER':
        ToastService.confirm({
          title: 'Sign out?',
          message: "You haven't finished setting up your profile. Going back now signs you out and your answers won't be saved.",
          confirmLabel: 'Sign out',
          cancelLabel: 'Stay',
          destructive: true,
          onConfirm: onExit,
        });
        return;
      case 'BIRTHDAY': return handleTransition('GENDER',  formData, false);
      case 'METRICS':  return handleTransition('BIRTHDAY', formData, false);
      case 'GOAL':     return handleTransition('METRICS',  formData, false);
      case 'LEVEL':    return handleTransition('GOAL',     formData, false);
      case 'SUCCESS':  return handleTransition('LEVEL',    formData, false);
    }
  };

  const renderStep = () => {
    const props = { onNext: handleNext, onBack: handleBack };
    switch (currentStep) {
      case 'GENDER':   return <GenderStep {...props} />;
      case 'BIRTHDAY': return <BirthdayStep {...props} />;
      // Gender is chosen two steps earlier; the figure needs it.
      case 'METRICS':  return <BodyMetricsStep {...props} gender={formData.gender} />;
      case 'GOAL':     return <GoalStep {...props} />;
      case 'LEVEL':    return <LevelStep {...props} />;
      case 'SUCCESS':  return <SuccessStep plan={calculateNutritionPlan(formData)} onFinish={() => handleNext()} isSaving={isCompleting} />;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.stepWrapper, { transform: [{ translateX: slideAnim }] }]}>
        {renderStep()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  stepWrapper: { flex: 1 },
});
