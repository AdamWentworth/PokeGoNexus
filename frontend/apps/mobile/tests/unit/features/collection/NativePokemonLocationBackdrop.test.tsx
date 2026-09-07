import { render, screen } from '@testing-library/react-native';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import { RadialGradient } from 'react-native-svg';
import { NativePokemonLocationBackdrop } from '../../../../src/features/collection/parity/NativePokemonLocationBackdrop';

jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const makeSvgElement = (displayName: string) => {
    const SvgElement = React.forwardRef(({ children, ...props }: any, ref: any) => (
      React.createElement(View, { ...props, ref }, children)
    ));
    SvgElement.displayName = displayName;
    return SvgElement;
  };
  return {
    __esModule: true,
    default: makeSvgElement('Svg'),
    Defs: makeSvgElement('Defs'),
    Image: makeSvgElement('SvgImage'),
    Mask: makeSvgElement('Mask'),
    RadialGradient: makeSvgElement('RadialGradient'),
    Rect: makeSvgElement('Rect'),
    Stop: makeSvgElement('Stop'),
  };
});

describe('NativePokemonLocationBackdrop', () => {
  it('uses the exact tall Vite instance mask and top-aligned cover crop', () => {
    render(
      <NativePokemonLocationBackdrop
        uri="https://pokegonexus.com/images/backgrounds/Location_Card_London.png"
        variant="instance"
      />,
    );

    const contract = collectionExperienceParityContract.locationBackdrop.instanceMask;
    const mask = screen.UNSAFE_getAllByType(RadialGradient)[0];
    expect(mask.props).toMatchObject({
      cx: contract.cx,
      cy: contract.cy,
      rx: contract.rx,
      ry: contract.ry,
    });
    expect(screen.getByTestId('native-location-backdrop-image', {
      includeHiddenElements: true,
    }).props.preserveAspectRatio)
      .toBe('xMidYMin slice');
    expect(screen.getByTestId('native-location-backdrop-brightness', {
      includeHiddenElements: true,
    })).toBeTruthy();
  });

  it('keeps collection-card backgrounds on Vite’s circular centered mask', () => {
    render(
      <NativePokemonLocationBackdrop
        uri="https://pokegonexus.com/images/backgrounds/Location_Card_London.png"
      />,
    );

    const contract = collectionExperienceParityContract.locationBackdrop.cardMask;
    const mask = screen.UNSAFE_getAllByType(RadialGradient)[0];
    expect(mask.props).toMatchObject({
      cx: contract.cx,
      cy: contract.cy,
      rx: contract.rx,
      ry: contract.ry,
    });
    expect(screen.getByTestId('native-location-backdrop-image', {
      includeHiddenElements: true,
    }).props.preserveAspectRatio)
      .toBe('xMidYMid slice');
  });
});
