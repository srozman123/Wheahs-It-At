import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getTag } from '../theme/tags';
import { line } from '../theme';

/**
 * Card header. Uses the event's image when it has one; otherwise draws a
 * polka-dot poster in the event's main tag color with a big emoji.
 */
export function EventArt({ imageUrl, tags, height, emojiSize = 72 }: { imageUrl: string | null; tags: string[]; height: number; emojiSize?: number }) {
  const tag = getTag(tags[0] ?? '');
  const c = line[tag.color];

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={{ width: '100%', height }} resizeMode="cover" />;
  }

  const dots = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 10; col++) {
      dots.push(<Circle key={`${row}-${col}`} cx={col * 40 + (row % 2) * 20} cy={row * 34} r={5} fill={c.dark} opacity={0.18} />);
    }
  }

  return (
    <View style={[styles.wrap, { height, backgroundColor: c.base }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        {dots}
      </Svg>
      <View style={[styles.sticker, { width: emojiSize * 1.6, height: emojiSize * 1.6, borderRadius: emojiSize }]}>
        <Text style={{ fontSize: emojiSize }}>{tag.emoji}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sticker: {
    backgroundColor: '#FFFDF8',
    borderWidth: 3,
    borderColor: '#2B2118',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
});
