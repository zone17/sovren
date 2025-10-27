import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Database,
  Eye,
  Gauge,
  History,
  Key,
  Lock,
  Play,
  RefreshCw,
  Settings,
  Shield,
  UserCheck,
  Users,
  UserX,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useAutonomousUserManagement } from '../../services/autonomous-user-management-service';
import {
  AccessControlMetrics,
  BehaviorAnalyticsMetrics,
  BehaviorAnomaly,
  BulkOperation,
  BulkOperationsMetrics,
  RoleDefinition,
  UserAccountMetrics,
  UserAccountOperation,
  UserAccountPolicy,
  UserRoleAssignment,
} from '../../types/autonomous-user-management';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// ============================================================================
// AUTONOMOUS USER MANAGEMENT DASHBOARD COMPONENTS
// ============================================================================

// === US-171: Automated User Account Management Panel ===
const AutomatedAccountManagementPanel: React.FC = () => {
  const userManagementService = useAutonomousUserManagement();
  const [accountMetrics, setAccountMetrics] = useState<UserAccountMetrics | null>(null);
  const [accountOperations, setAccountOperations] = useState<UserAccountOperation[]>([]);
  const [accountPolicies, setAccountPolicies] = useState<UserAccountPolicy[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    const loadAccountData = async () => {
      try {
        const [metrics, operations, policies] = await Promise.all([
          userManagementService.getAccountMetrics(),
          userManagementService.getAccountOperations(),
          userManagementService.getAccountPolicies(),
        ]);

        setAccountMetrics(metrics);
        setAccountOperations(operations);
        setAccountPolicies(policies);
      } catch (error) {
        console.error('Failed to load account management data:', error);
      }
    };

    loadAccountData();
  }, [userManagementService]);

  const executeOperation = useCallback(
    async (operationType: string) => {
      setIsExecuting(true);
      try {
        const operation = await userManagementService.executeAccountOperation({
          operationType: operationType as any,
          reason: `Manual execution of ${operationType}`,
          triggeredBy: 'admin_action',
        });

        setAccountOperations((prev) => [operation, ...prev.slice(0, 9)]);
      } catch (error) {
        console.error('Operation execution failed:', error);
      } finally {
        setIsExecuting(false);
      }
    },
    [userManagementService]
  );

  const getOperationStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
  };

  const getAutomationLevelColor = (level: string) => {
    switch (level) {
      case 'autonomous':
        return 'default';
      case 'supervised':
        return 'secondary';
      case 'manual':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Bot className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold">Automated Account Management</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => executeOperation('profile_update')}
            disabled={isExecuting}
            variant="outline"
            size="sm"
          >
            {isExecuting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="ml-2">Execute Operation</span>
          </Button>
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Policies</span>
          </Button>
        </div>
      </div>

      {/* Account Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Users</p>
                <p className="text-2xl font-bold">{accountMetrics?.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  +{accountMetrics?.newUsersToday} today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold">{accountMetrics?.activeUsers.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {(
                    ((accountMetrics?.activeUsers || 0) / (accountMetrics?.totalUsers || 1)) *
                    100
                  ).toFixed(1)}
                  % active rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Automated Ops</p>
                <p className="text-2xl font-bold">{accountMetrics?.automatedOperations}</p>
                <p className="text-xs text-muted-foreground">
                  {((accountMetrics?.automationSuccessRate || 0) * 100).toFixed(1)}% success rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Avg Processing</p>
                <p className="text-2xl font-bold">{accountMetrics?.averageOperationTime}ms</p>
                <p className="text-xs text-muted-foreground">
                  {accountMetrics?.pendingOperations} pending
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserX className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Suspended</p>
                <p className="text-2xl font-bold">{accountMetrics?.suspendedUsers}</p>
                <p className="text-xs text-muted-foreground">Security actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="w-5 h-5" />
            <span>Risk Score Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {accountMetrics?.riskScoreDistribution &&
              Object.entries(accountMetrics.riskScoreDistribution).map(([level, value]) => (
                <div key={level} className="text-center">
                  <div className="text-2xl font-bold">{(value * 100).toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground capitalize">{level} Risk</div>
                  <Progress value={value * 100} className="mt-2" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Recent Account Operations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accountOperations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No recent operations. Click "Execute Operation" to start.
              </div>
            ) : (
              accountOperations.map((operation) => (
                <div
                  key={operation.id}
                  className="flex justify-between items-center p-3 rounded-lg border hover:bg-accent"
                >
                  <div className="flex items-center space-x-3">
                    {getOperationStatusIcon(operation.status)}
                    <div>
                      <p className="font-medium">{operation.operationType.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">{operation.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getAutomationLevelColor(operation.automationLevel)}>
                      {operation.automationLevel}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(operation.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-172: Autonomous Role-Based Access Control Panel ===
const AutonomousRBACPanel: React.FC = () => {
  const userManagementService = useAutonomousUserManagement();
  const [accessMetrics, setAccessMetrics] = useState<AccessControlMetrics | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignment[]>([]);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  useEffect(() => {
    const loadRBACData = async () => {
      try {
        const [metrics, roleDefinitions] = await Promise.all([
          userManagementService.getAccessControlMetrics(),
          userManagementService.getRoleDefinitions(),
        ]);

        setAccessMetrics(metrics);
        setRoles(roleDefinitions);
      } catch (error) {
        console.error('Failed to load RBAC data:', error);
      }
    };

    loadRBACData();
  }, [userManagementService]);

  const createNewRole = useCallback(async () => {
    setIsCreatingRole(true);
    try {
      const newRole = await userManagementService.createRole({
        name: `AI Role ${Date.now()}`,
        description: 'AI-generated role based on behavioral analysis',
      });

      setRoles((prev) => [newRole, ...prev]);
    } catch (error) {
      console.error('Role creation failed:', error);
    } finally {
      setIsCreatingRole(false);
    }
  }, [userManagementService]);

  const assignRole = useCallback(
    async (roleId: string) => {
      try {
        const assignment = await userManagementService.assignRole(
          `user_${Date.now()}`,
          roleId,
          'AI-recommended role assignment'
        );

        setRoleAssignments((prev) => [assignment, ...prev.slice(0, 9)]);
      } catch (error) {
        console.error('Role assignment failed:', error);
      }
    },
    [userManagementService]
  );

  const getAssignmentColor = (assignedBy: string) => {
    switch (assignedBy) {
      case 'ai_analysis':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'system':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Key className="w-6 h-6 text-green-500" />
          <h3 className="text-lg font-semibold">Autonomous Role-Based Access Control</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={createNewRole}
            disabled={isCreatingRole}
            className="flex items-center space-x-2"
          >
            {isCreatingRole ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            <span>Create AI Role</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Role Settings</span>
          </Button>
        </div>
      </div>

      {/* Access Control Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Roles</p>
                <p className="text-2xl font-bold">{accessMetrics?.totalRoles}</p>
                <p className="text-xs text-muted-foreground">Active definitions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Assignments</p>
                <p className="text-2xl font-bold">{accessMetrics?.activeRoleAssignments}</p>
                <p className="text-xs text-muted-foreground">
                  {accessMetrics?.automatedAssignments} automated
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">AI Accuracy</p>
                <p className="text-2xl font-bold">
                  {((accessMetrics?.averageRoleAccuracy || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Role assignment accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Violations</p>
                <p className="text-2xl font-bold">{accessMetrics?.accessViolations}</p>
                <p className="text-xs text-muted-foreground">
                  {accessMetrics?.privilegeEscalations} escalations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Definitions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="w-5 h-5" />
            <span>AI-Managed Role Definitions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No roles defined. Click "Create AI Role" to start.
              </div>
            ) : (
              roles.map((role) => (
                <div
                  key={role.id}
                  className="flex justify-between items-center p-3 rounded-lg border hover:bg-accent"
                >
                  <div className="flex items-center space-x-3">
                    <Key className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={role.automatedAssignment.enabled ? 'default' : 'secondary'}>
                      Level {role.hierarchy.level}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => assignRole(role.id)}>
                      Assign
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-173: AI-Powered User Behavior Analytics Panel ===
const BehaviorAnalyticsPanel: React.FC = () => {
  const userManagementService = useAutonomousUserManagement();
  const [behaviorMetrics, setBehaviorMetrics] = useState<BehaviorAnalyticsMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<BehaviorAnomaly[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const loadBehaviorData = async () => {
      try {
        const [metrics, behaviorAnomalies] = await Promise.all([
          userManagementService.getBehaviorAnalyticsMetrics(),
          userManagementService.getBehaviorAnomalies(),
        ]);

        setBehaviorMetrics(metrics);
        setAnomalies(behaviorAnomalies);
      } catch (error) {
        console.error('Failed to load behavior analytics data:', error);
      }
    };

    loadBehaviorData();
  }, [userManagementService]);

  const trackBehaviorEvent = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      await userManagementService.trackBehaviorEvent({
        eventType: 'unusual_activity',
        eventData: { triggered: 'manual_analysis' },
      });

      // Refresh anomalies
      const newAnomalies = await userManagementService.getBehaviorAnomalies();
      setAnomalies(newAnomalies);
    } catch (error) {
      console.error('Behavior tracking failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [userManagementService]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'unusual_login_time':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'unusual_location':
        return <Eye className="w-4 h-4 text-red-500" />;
      case 'security_violation':
        return <Shield className="w-4 h-4 text-red-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Brain className="w-6 h-6 text-purple-500" />
          <h3 className="text-lg font-semibold">AI-Powered Behavior Analytics</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={trackBehaviorEvent}
            disabled={isAnalyzing}
            className="flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span>Analyze Behavior</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Reports</span>
          </Button>
        </div>
      </div>

      {/* Behavior Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Events</p>
                <p className="text-2xl font-bold">
                  {behaviorMetrics?.totalEvents.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {behaviorMetrics?.eventsToday} today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Unique Users</p>
                <p className="text-2xl font-bold">{behaviorMetrics?.uniqueUsers}</p>
                <p className="text-xs text-muted-foreground">Active in period</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Anomalies</p>
                <p className="text-2xl font-bold">{behaviorMetrics?.anomaliesDetected}</p>
                <p className="text-xs text-muted-foreground">
                  {behaviorMetrics?.highRiskUsers} high-risk users
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">AI Accuracy</p>
                <p className="text-2xl font-bold">
                  {((behaviorMetrics?.patternRecognitionAccuracy || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {behaviorMetrics?.responseTime}ms response
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Score Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Gauge className="w-5 h-5" />
            <span>Risk Assessment Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-2">Average Risk Score</h4>
              <div className="text-3xl font-bold text-green-600">
                {((behaviorMetrics?.averageRiskScore || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Platform-wide average</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">False Positive Rate</h4>
              <div className="text-3xl font-bold text-blue-600">
                {((behaviorMetrics?.falsePositiveRate || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">AI accuracy metric</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Recent Behavior Anomalies</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No recent anomalies detected. System operating normally.
              </div>
            ) : (
              anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="flex justify-between items-center p-3 rounded-lg border hover:bg-accent"
                >
                  <div className="flex items-center space-x-3">
                    {getAnomalyIcon(anomaly.anomalyType)}
                    <div>
                      <p className="font-medium">{anomaly.anomalyType.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getSeverityColor(anomaly.severity)}>{anomaly.severity}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {new Date(anomaly.detectedAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-174: Autonomous Bulk Operations Panel ===
const BulkOperationsPanel: React.FC = () => {
  const userManagementService = useAutonomousUserManagement();
  const [bulkMetrics, setBulkMetrics] = useState<BulkOperationsMetrics | null>(null);
  const [bulkOperations, setBulkOperations] = useState<BulkOperation[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const loadBulkData = async () => {
      try {
        const [metrics, operations] = await Promise.all([
          userManagementService.getBulkOperationsMetrics(),
          userManagementService.getBulkOperations(),
        ]);

        setBulkMetrics(metrics);
        setBulkOperations(operations);
      } catch (error) {
        console.error('Failed to load bulk operations data:', error);
      }
    };

    loadBulkData();
  }, [userManagementService]);

  const createBulkOperation = useCallback(async () => {
    setIsCreating(true);
    try {
      const operation = await userManagementService.createBulkOperation({
        name: `AI Bulk Operation ${Date.now()}`,
        description: 'AI-generated bulk operation for user management',
        operationType: 'user_role_update',
      });

      setBulkOperations((prev) => [operation, ...prev]);
    } catch (error) {
      console.error('Bulk operation creation failed:', error);
    } finally {
      setIsCreating(false);
    }
  }, [userManagementService]);

  const executeBulkOperation = useCallback(
    async (operationId: string) => {
      try {
        await userManagementService.executeBulkOperation(operationId);

        // Refresh operations list
        const updatedOperations = await userManagementService.getBulkOperations();
        setBulkOperations(updatedOperations);
      } catch (error) {
        console.error('Bulk operation execution failed:', error);
      }
    },
    [userManagementService]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Database className="w-6 h-6 text-indigo-500" />
          <h3 className="text-lg font-semibold">Autonomous Bulk Operations</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={createBulkOperation}
            disabled={isCreating}
            className="flex items-center space-x-2"
          >
            {isCreating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>Create Operation</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Templates</span>
          </Button>
        </div>
      </div>

      {/* Bulk Operations Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Operations</p>
                <p className="text-2xl font-bold">{bulkMetrics?.totalOperations}</p>
                <p className="text-xs text-muted-foreground">
                  {bulkMetrics?.completedToday} completed today
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold">
                  {((bulkMetrics?.averageSuccessRate || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {bulkMetrics?.activeOperations} active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Users Affected</p>
                <p className="text-2xl font-bold">
                  {bulkMetrics?.usersAffectedToday.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Automation Rate</p>
                <p className="text-2xl font-bold">
                  {((bulkMetrics?.automationRate || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {((bulkMetrics?.errorRate || 0) * 100).toFixed(2)}% error rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Operation Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-2">Average Execution Time</h4>
              <div className="text-3xl font-bold text-blue-600">
                {((bulkMetrics?.averageExecutionTime || 0) / 1000).toFixed(1)}s
              </div>
              <p className="text-xs text-muted-foreground">Per operation</p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Processing Efficiency</h4>
              <div className="text-3xl font-bold text-green-600">
                {(100 - (bulkMetrics?.errorRate || 0) * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Success rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Recent Bulk Operations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bulkOperations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No bulk operations. Click "Create Operation" to start.
              </div>
            ) : (
              bulkOperations.map((operation) => (
                <div
                  key={operation.id}
                  className="flex justify-between items-center p-3 rounded-lg border hover:bg-accent"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(operation.status)}
                    <div>
                      <p className="font-medium">{operation.name}</p>
                      <p className="text-sm text-muted-foreground">{operation.description}</p>
                      {operation.status === 'running' && (
                        <Progress
                          value={
                            (operation.progress.processedItems / operation.progress.totalItems) *
                            100
                          }
                          className="mt-1 w-32"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getStatusColor(operation.status)}>{operation.status}</Badge>
                    {operation.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeBulkOperation(operation.id)}
                      >
                        Execute
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === Main Dashboard Component ===
const AutonomousUserManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('account-management');

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="mx-auto space-y-6 max-w-7xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Autonomous User Management</h1>
            <p className="text-muted-foreground">
              AI-powered user management with autonomous operations, behavioral analytics, and
              enterprise-grade automation
            </p>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Bot className="mr-1 w-3 h-3" />
            AI Systems Active
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="account-management" className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Account Management</span>
            </TabsTrigger>
            <TabsTrigger value="access-control" className="flex items-center space-x-2">
              <Key className="w-4 h-4" />
              <span>Access Control</span>
            </TabsTrigger>
            <TabsTrigger value="behavior-analytics" className="flex items-center space-x-2">
              <Brain className="w-4 h-4" />
              <span>Behavior Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-operations" className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Bulk Operations</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account-management">
            <AutomatedAccountManagementPanel />
          </TabsContent>

          <TabsContent value="access-control">
            <AutonomousRBACPanel />
          </TabsContent>

          <TabsContent value="behavior-analytics">
            <BehaviorAnalyticsPanel />
          </TabsContent>

          <TabsContent value="bulk-operations">
            <BulkOperationsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutonomousUserManagementDashboard;
