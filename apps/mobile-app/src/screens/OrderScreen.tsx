import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { trpc } from '../lib/trpc';

export default function OrderScreen({ route, navigation }: any) {
  const { orderId } = route.params || {};
  
  const { data: order, isLoading } = trpc.order.get.useQuery(
    { orderId },
    { enabled: !!orderId }
  );

  const kotMutation = trpc.kot.generate.useMutation({
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const handleSendToKitchen = () => {
    if (orderId) {
      kotMutation.mutate({ orderId });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const renderItem = ({ item }: any) => (
    <View style={styles.orderItem}>
      <View style={styles.orderItemContent}>
        <Text style={styles.itemQuantity}>{item.quantity}x</Text>
        <View style={styles.itemDetails}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.notes && <Text style={styles.itemNotes}>Note: {item.notes}</Text>}
        </View>
        <Text style={styles.itemPrice}>₹{(item.price * item.quantity / 100).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Order Header */}
      <View style={styles.header}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.tableInfo}>
          Table {order.table?.number || 'N/A'} • {order.type}
        </Text>
        <Text style={styles.statusBadge}>{order.status}</Text>
      </View>

      {/* Order Items */}
      <FlatList
        data={order.items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.itemsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items in this order</Text>
          </View>
        }
      />

      {/* Order Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{(order.subtotal / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>₹{(order.taxTotal / 100).toFixed(2)}</Text>
        </View>
        {order.serviceCharge > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Charge</Text>
            <Text style={styles.summaryValue}>₹{(order.serviceCharge / 100).toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₹{(order.grandTotal / 100).toFixed(2)}</Text>
        </View>
      </View>

      {/* Actions */}
      {order.status === 'OPEN' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, kotMutation.isPending && styles.buttonDisabled]}
            onPress={handleSendToKitchen}
            disabled={kotMutation.isPending}
          >
            <Text style={styles.buttonText}>
              {kotMutation.isPending ? 'Sending...' : 'Send to Kitchen'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  orderNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tableInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
  },
  itemsList: {
    padding: 16,
  },
  orderItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
    minWidth: 30,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  summary: {
    backgroundColor: 'white',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 12,
    marginTop: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  actions: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
