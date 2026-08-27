import React, { useCallback, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ArticleRepository } from '@/repositories/ArticleRepository';
import { Article } from '@/types';
import { ArticleListItem } from '@/components/ArticleListItem';
import { EmptyState } from '@/components/EmptyState';
import { BottomTabParamList } from '@/navigation/types';

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList>>();
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (searchText: string) => {
    const results = await ArticleRepository.list(searchText);
    setArticles(results);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
      // Intentionally not depending on `search` here beyond initial focus --
      // live typing already triggers reloads via handleSearchChange below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const handleSearchChange = (text: string) => {
    setSearch(text);
    load(text);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Articles</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddArticleTab')}
        >
          <Text style={styles.addButtonText}>+ Add Article</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search articles..."
        value={search}
        onChangeText={handleSearchChange}
        autoCapitalize="none"
      />

      {!loading && articles.length === 0 ? (
        <EmptyState
          title={search ? 'No articles match your search' : 'No articles yet'}
          subtitle={search ? 'Try a different search term.' : 'Tap "+ Add Article" to register your first item.'}
        />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ArticleListItem article={item} />}
        />
      )}

      <TouchableOpacity style={styles.billingCta} onPress={() => navigation.navigate('Billing')}>
        <Text style={styles.billingCtaText}>Go to Billing →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  addButton: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  billingCta: {
    margin: 16,
    backgroundColor: '#eef0ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  billingCtaText: { color: '#1a1a2e', fontWeight: '600', fontSize: 14 },
});
