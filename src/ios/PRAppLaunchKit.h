//
//  PRAppLaunchKit.h
//  PRAppLaunchKit
//
//  Created by Vitali Bounine on 2015-03-10.
//  Copyright (c) 2015 NewspaperDirect. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <Cordova/CDVPlugin.h>

@interface PRAppLaunchKit : CDVPlugin

- (IBAction)launchPR:(id)sender;

@property (nonatomic, retain) IBOutlet UISwitch * removeAllContentSwitch;
@end
