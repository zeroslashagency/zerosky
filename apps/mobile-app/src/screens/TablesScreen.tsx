import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { trpc } from '../lib/trpc';

export default function TablesScreen({ navigation }: any) {
  const { data: tables = [], isLoading } = trpc.table.list.useQuery({
    branchId: 'default-branch', // TODO: get from user context
  });

  const getTableColor = (state: string) => {
    switch (state) {
      case 'AVAILABLE':
        return '#10B981';
      case 'OCCUPIED':
        return '#EF4444';
      case 'RESERVED':
        return '#F59E0B';
      case 'BILLED':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const renderTable = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.tableCard, { borderLeftColor: getTableColor(item.state), borderLeftWidth: 4 }]}
      onPress={() => navigation.navigate('Menu', { tableId: item.id })}
    >
      <View style={styles.tableHeader}>
        <Text style={styles.tableName}>{item.name}</Text>
        <Text style={[styles.tableStatus, { color: getTableColor(item.state) }]}>
          {item.state}
        </Text>
      </View>
      <Text style={styles.tableInfo}>Capacity: {item.seats} guests</Text>
      {item.section && <Text style={styles.tableSection}>{item.section}</Text>}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading tables...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tables}
        renderItem={renderTable}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tables found</Text>
          </View>
        }
      />
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
  listContainer: {
    padding: 16,
  },
  tableCard: {
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
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tableStatus: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tableSection: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
