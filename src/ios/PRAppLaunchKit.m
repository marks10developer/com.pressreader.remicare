//
//  PRAppLaunchKit.m
//  PRAppLaunchKit
//
//  Created by Vitali Bounine on 2015-03-10.
//  Copyright (c) 2015 NewspaperDirect. All rights reserved.
//

#import "PRAppLaunchKit.h"
#import "PressReader_SDK/PressReader.h"
#import <Cordova/CDV.h>

@implementation PRAppLaunchKit

- (IBAction)launchPR:(id)sender {
    [[PressReader instance] setRemoveAllContent:self.removeAllContentSwitch.isOn];
    self.removeAllContentSwitch.on = NO;

    [self presentViewController:[[PressReader instance] rootViewController]
                       animated:YES
                     completion:nil];
    
    [[PressReader instance] launch];
}