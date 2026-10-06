// Must be the first import anywhere a THREE.Color might be constructed.
// With colour management off, a palette hex value is exactly the colour on screen.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;
